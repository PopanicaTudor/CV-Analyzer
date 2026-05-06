# CV Analyzer Pro

AI-powered career assistant built as a production-style full-stack system:

React frontend -> Django REST API -> RabbitMQ -> threaded ML worker -> PostgreSQL

## Features

- JWT registration and login.
- Authenticated PDF/DOCX CV upload.
- Asynchronous processing through RabbitMQ.
- Separate Python worker service.
- Mandatory threaded processing stages:
  - text extraction
  - keyword extraction
  - ML scoring
  - job matching
- Real NLP/ML pipeline with NLTK preprocessing, TF-IDF features, Logistic Regression, transformer sentence embeddings, and cosine similarity.
- Separate CV writing-quality model with a 0-100 mark, quality breakdown, and improvement suggestions.
- Extended result advice with strengths, missing role signals, career path steps, prioritized improvements, and bullet rewrite examples.
- PostgreSQL persistence for users, CV metadata, and analysis results.
- React UI with drag/drop upload, status polling, career-fit score, CV-writing score, history, job matches, and keyword highlighting.
- Docker deployment for backend, worker, frontend, RabbitMQ, and database.

## Project Structure

```text
.
├── backend/
│   ├── authentication/      # Custom user model, JWT auth endpoints
│   ├── config/              # Django settings and root URLs
│   ├── cv_processing/       # CV model, upload/history/status APIs, RabbitMQ producer
│   ├── results/             # Result model and serializer
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── worker/
│   ├── data/job_descriptions.json
│   ├── consumer.py
│   ├── ml_model.py
│   ├── nlp_pipeline.py
│   ├── processor.py
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
└── .env.example
```

## Run With Docker

```bash
docker-compose up --build
```

Services:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- RabbitMQ management: http://localhost:15672
- PostgreSQL: localhost:5432

Default RabbitMQ credentials are `cv_user` / `cv_password`.

## API Endpoints

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/token/refresh
GET  /api/auth/me

POST /api/cv/upload
GET  /api/cv/<id>/status
GET  /api/cv/<id>/result
DELETE /api/cv/<id>
GET  /api/cv/history
```

Upload messages published to RabbitMQ use this format:

```json
{
  "cv_id": 1,
  "file_path": "/app/backend/media/cvs/2026/05/05/example.pdf",
  "user_id": 1
}
```

## Local Development

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Worker requires the backend settings and database/RabbitMQ services. With Docker, it is started automatically.
