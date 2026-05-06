FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV NLTK_DATA=/usr/local/share/nltk_data

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/requirements.txt
COPY worker/requirements.txt worker/requirements.txt

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r backend/requirements.txt -r worker/requirements.txt \
    && python -m nltk.downloader -d /usr/local/share/nltk_data punkt punkt_tab stopwords wordnet omw-1.4

RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY backend backend
COPY worker worker

CMD ["python", "-m", "worker.consumer"]
