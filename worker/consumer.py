import json
import logging
import os
import sys
import time
from pathlib import Path

import pika


BASE_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.db import close_old_connections, transaction  # noqa: E402
from django.utils import timezone  # noqa: E402

from cv_processing.models import CV, CVStatus  # noqa: E402
from results.models import Result  # noqa: E402

from .processor import CVProcessor  # noqa: E402


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

MAX_RETRIES = int(os.environ.get("WORKER_MAX_RETRIES", "3"))
PREFETCH_COUNT = int(os.environ.get("WORKER_PREFETCH", "1"))


class CVConsumer:
    def __init__(self):
        self.processor = CVProcessor()

    def connect(self):
        parameters = pika.URLParameters(settings.RABBITMQ_URL)
        while True:
            try:
                connection = pika.BlockingConnection(parameters)
                channel = connection.channel()
                channel.queue_declare(queue=settings.CV_QUEUE_NAME, durable=True)
                channel.basic_qos(prefetch_count=PREFETCH_COUNT)
                return connection, channel
            except pika.exceptions.AMQPError as exc:
                logger.warning("RabbitMQ connection failed: %s. Retrying in 5 seconds.", exc)
                time.sleep(5)

    def start(self):
        while True:
            connection, channel = self.connect()
            try:
                channel.basic_consume(queue=settings.CV_QUEUE_NAME, on_message_callback=self.handle_message)
                logger.info("Worker listening on queue %s", settings.CV_QUEUE_NAME)
                channel.start_consuming()
            except pika.exceptions.AMQPError as exc:
                logger.exception("RabbitMQ consumer error: %s", exc)
                try:
                    connection.close()
                except pika.exceptions.AMQPError:
                    pass
                time.sleep(5)

    def handle_message(self, channel, method, properties, body):
        close_old_connections()
        payload = {}
        retries = int((properties.headers or {}).get("x-retries", 0))

        try:
            payload = json.loads(body.decode("utf-8"))
            cv_id = int(payload["cv_id"])
            user_id = int(payload["user_id"])
            file_path = payload["file_path"]

            cv = CV.objects.filter(id=cv_id, user_id=user_id).only("target_jobs").first()
            if cv is None:
                logger.info("Skipping stale queue message for deleted CV %s", cv_id)
                channel.basic_ack(delivery_tag=method.delivery_tag)
                return

            self.mark_cv(cv_id, user_id, CVStatus.PROCESSING, "")
            result_data = self.processor.process(
                cv_id=cv_id,
                file_path=file_path,
                user_id=user_id,
                target_jobs=payload.get("target_jobs", cv.target_jobs or []),
            )
            self.save_result(cv_id, user_id, result_data)
            channel.basic_ack(delivery_tag=method.delivery_tag)
            logger.info("Processed CV %s successfully", cv_id)
        except Exception as exc:
            logger.exception("CV processing failed. retries=%s payload=%s", retries, payload)
            if retries < MAX_RETRIES and payload:
                self.mark_cv(
                    payload.get("cv_id"),
                    payload.get("user_id"),
                    CVStatus.PENDING,
                    f"Retrying after worker error: {exc}",
                )
                self.republish(channel, payload, retries + 1)
                channel.basic_ack(delivery_tag=method.delivery_tag)
            else:
                if payload:
                    self.mark_cv(payload.get("cv_id"), payload.get("user_id"), CVStatus.FAILED, str(exc))
                channel.basic_ack(delivery_tag=method.delivery_tag)
        finally:
            close_old_connections()

    def republish(self, channel, payload, retries):
        channel.basic_publish(
            exchange="",
            routing_key=settings.CV_QUEUE_NAME,
            body=json.dumps(payload).encode("utf-8"),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=pika.DeliveryMode.Persistent,
                headers={"x-retries": retries},
            ),
        )

    def mark_cv(self, cv_id, user_id, status, error_message):
        if not cv_id or not user_id:
            return
        CV.objects.filter(id=cv_id, user_id=user_id).update(
            status=status,
            error_message=error_message,
            updated_at=timezone.now(),
        )

    def save_result(self, cv_id, user_id, result_data):
        with transaction.atomic():
            cv = CV.objects.select_for_update().get(id=cv_id, user_id=user_id)
            Result.objects.update_or_create(cv=cv, defaults=result_data)
            cv.status = CVStatus.DONE
            cv.error_message = ""
            cv.save(update_fields=["status", "error_message", "updated_at"])


if __name__ == "__main__":
    CVConsumer().start()
