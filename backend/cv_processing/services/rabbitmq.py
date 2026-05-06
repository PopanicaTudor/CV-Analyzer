import json
import logging
import time

import pika
from django.conf import settings

logger = logging.getLogger(__name__)


class RabbitMQPublishError(RuntimeError):
    pass


def _connection_parameters():
    return pika.URLParameters(settings.RABBITMQ_URL)


def publish_cv_uploaded(cv):
    payload = {
        "cv_id": cv.id,
        "file_path": str(cv.file.path),
        "user_id": cv.user_id,
    }

    body = json.dumps(payload).encode("utf-8")
    last_error = None

    for attempt in range(1, 6):
        try:
            connection = pika.BlockingConnection(_connection_parameters())
            channel = connection.channel()
            channel.queue_declare(queue=settings.CV_QUEUE_NAME, durable=True)
            channel.basic_publish(
                exchange="",
                routing_key=settings.CV_QUEUE_NAME,
                body=body,
                properties=pika.BasicProperties(
                    content_type="application/json",
                    delivery_mode=pika.DeliveryMode.Persistent,
                ),
            )
            connection.close()
            logger.info("Published CV %s to queue %s", cv.id, settings.CV_QUEUE_NAME)
            return
        except pika.exceptions.AMQPError as exc:
            last_error = exc
            logger.warning("RabbitMQ publish attempt %s failed for CV %s: %s", attempt, cv.id, exc)
            time.sleep(min(attempt, 5))

    raise RabbitMQPublishError(f"Could not publish CV {cv.id} to RabbitMQ") from last_error
