# CV Analyzer Pro

CV Analyzer Pro este o aplicație full-stack pentru încărcarea, procesarea și evaluarea CV-urilor. Proiectul leagă explicit conceptele din cursuri într-un flux complet:

```text
React frontend
    |
    | HTTP + JWT
    v
Django REST API
    |
    | mesaj JSON prin AMQP
    v
RabbitMQ queue: cv_processing
    |
    | worker consumer
    v
Python ML worker cu thread-uri
    |
    | Django ORM
    v
PostgreSQL
```

Aplicația nu procesează CV-ul direct în request-ul HTTP. Backend-ul salvează fișierul și publică un mesaj în RabbitMQ, iar worker-ul separat preia mesajul, rulează analiza NLP/ML în etape paralele și persistă rezultatul în baza de date. Frontend-ul verifică statusul și afișează scorurile când analiza este finalizată.

## Funcționalități

- Autentificare cu JWT: register, login, refresh token și endpoint pentru utilizatorul curent.
- Upload securizat de CV-uri PDF/DOCX, cu limită de 10 MB.
- Validare de joburi țintă, folosite pentru evaluarea alinierii CV-ului la rolurile dorite.
- Procesare asincronă prin RabbitMQ.
- Worker Python separat de backend.
- Procesare internă pe thread-uri pentru:
  - extragere text;
  - extragere keyword-uri;
  - scor ML pentru direcția profesională;
  - matching cu joburi de referință și joburi țintă.
- Pipeline NLP/ML cu NLTK, TF-IDF, Logistic Regression, sentence embeddings și cosine similarity.
- Scor separat pentru calitatea redactării CV-ului.
- Recomandări personalizate: puncte forte, keyword-uri lipsă, plan de îmbunătățire, traseu profesional și exemple de rescriere.
- Persistență în PostgreSQL pentru utilizatori, CV-uri și rezultate.
- Frontend React cu upload drag/drop, polling de status, istoric, scoruri și evidențiere de keyword-uri.
- Rulare completă cu Docker pentru frontend, backend, worker, RabbitMQ și PostgreSQL.

## Legătura Cu Cursurile

| Curs | Concept predat | Folosire în proiect |
| --- | --- | --- |
| Curs 1 - Docker | Imagine, container, Dockerfile, dependențe, porturi, mediu izolat | Fiecare componentă rulează în container propriu: `backend`, `worker`, `frontend`, `rabbitmq`, `db`. Imaginile custom sunt definite prin `backend/Dockerfile`, `worker/Dockerfile` și `frontend/Dockerfile`. |
| Curs 2 - Multithreading | Thread, `start()`, `join()`, `Lock`, `Event`, `Barrier`, sincronizare, race conditions | `worker/processor.py` creează thread-uri pentru etapele de analiză. Datele partajate sunt protejate cu `Lock`, thread-urile dependente așteaptă textul prin `Event`, iar finalizarea etapelor este coordonată cu `Barrier` și `join()`. |
| Curs 3 - RabbitMQ | Producer, consumer, queue, exchange, routing key, ACK, mesaje persistente, prefetch | Django este producer-ul, RabbitMQ este broker-ul, worker-ul este consumer-ul. Coada este declarată durabilă, mesajele sunt persistente, procesarea folosește manual ACK și `prefetch_count=1`. |
| Curs 4 - Django Part 1 | Request-response, backend, API, `urls.py`, `views.py`, `models.py`, relații între modele | Backend-ul expune API-uri REST prin Django/DRF. `urls.py` mapează rutele, view-urile procesează cererile, modelele definesc utilizatori, CV-uri și rezultate. |
| Curs 5 - Django Part 2 | CORS, PostgreSQL, JSON, variabile de mediu, JWT | Proiectul folosește `django-cors-headers`, PostgreSQL în Docker, câmpuri `JSONField`, configurare din environment variables și autentificare JWT cu `djangorestframework-simplejwt`. |
| Curs 6 - Machine Learning | Pipeline ML, învățare supervizată, clasificare, regresie logistică, date etichetate | Worker-ul antrenează modele pe date etichetate locale. Folosește `TfidfVectorizer` + `LogisticRegression` pentru clasificare de categorie și calitate CV, apoi combină rezultatele cu embeddings semantice. |

## Structura Proiectului

```text
.
├── backend/
│   ├── authentication/          # User custom, register/login/me, JWT
│   ├── config/                  # Settings, root URLs, WSGI/ASGI
│   ├── cv_processing/           # Model CV, upload/status/history/delete, RabbitMQ producer
│   ├── results/                 # Model Result și serializer pentru analiza finală
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                 # Client HTTP către backend
│   │   ├── components/          # UI reutilizabil
│   │   ├── context/             # Auth context
│   │   └── pages/               # Login, Register, Dashboard, Upload, Result, History
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── worker/
│   ├── data/
│   │   ├── job_descriptions.json
│   │   └── cv_quality_training.json
│   ├── consumer.py              # RabbitMQ consumer + integrare Django ORM
│   ├── ml_model.py              # Modele ML, embeddings și matching
│   ├── nlp_pipeline.py          # Tokenizare, stopwords, lematizare, TF-IDF keywords
│   ├── processor.py             # Orchestrare threaded a analizei CV
│   ├── text_utils.py            # Normalizare text și statistici
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
├── .env.example
└── README.md
```

## Fluxul De Procesare

1. Utilizatorul se autentifică în frontend și trimite un CV împreună cu lista de joburi țintă.
2. `CVUploadSerializer` validează extensia fișierului, dimensiunea și structura joburilor țintă.
3. `CVUploadView` salvează înregistrarea `CV` în PostgreSQL, cu status inițial `pending`.
4. Backend-ul publică în RabbitMQ un mesaj JSON cu `cv_id`, `file_path`, `user_id` și `target_jobs`.
5. Request-ul HTTP se termină rapid cu `202 Accepted`; analiza continuă în fundal.
6. `worker.consumer.CVConsumer` preia mesajul din coadă, marchează CV-ul ca `processing` și rulează `CVProcessor`.
7. `CVProcessor` extrage textul, calculează keyword-uri, scoruri ML, scor de calitate și potriviri cu joburi.
8. Rezultatul este salvat în modelul `Result`, iar statusul CV-ului devine `done`.
9. Frontend-ul interoghează endpoint-urile de status și rezultat până când analiza este disponibilă.

Mesajul trimis în coadă are forma:

```json
{
  "cv_id": 1,
  "file_path": "/app/backend/media/cvs/2026/05/05/example.pdf",
  "user_id": 1,
  "target_jobs": [
    {
      "title": "Python Developer",
      "description": "Django, PostgreSQL, REST APIs, Docker"
    }
  ]
}
```

## Docker

Conceptul din curs este folosit pentru a crea un mediu reproductibil și izolat. În loc să presupunem că toate dependențele există pe calculatorul local, proiectul definește containere pentru fiecare responsabilitate.

### `docker-compose.yml`

Definește cinci servicii:

- `db`: container PostgreSQL 16, cu volum persistent `postgres_data`.
- `rabbitmq`: container RabbitMQ cu plugin de management, expus pe porturile `5672` și `15672`.
- `backend`: aplicația Django REST API, construită din `backend/Dockerfile`.
- `worker`: proces Python separat, construit din `worker/Dockerfile`, care rulează `python -m worker.consumer`.
- `frontend`: aplicația React build-uită cu Node și servită prin Nginx.

Compose configurează și:

- `depends_on` cu healthcheck pentru ca backend-ul și worker-ul să pornească după PostgreSQL și RabbitMQ;
- volume persistente pentru baza de date și fișierele uploadate;
- variabile de mediu pentru conexiuni, credențiale și setări ML;
- port mappings pentru acces local la frontend, API, RabbitMQ Management UI și PostgreSQL.

### Dockerfile-uri

`backend/Dockerfile`:

- pornește de la `python:3.11-slim`;
- instalează dependențele din `requirements.txt`;
- copiază codul backend;
- rulează aplicația prin `entrypoint.sh`.

`worker/Dockerfile`:

- pornește tot de la `python:3.11-slim`;
- instalează dependențele backend + worker;
- descarcă resurse NLTK;
- descarcă modelul `sentence-transformers/all-MiniLM-L6-v2` la build time;
- pornește consumer-ul RabbitMQ.

`frontend/Dockerfile`:

- folosește build multi-stage;
- construiește aplicația cu Node 20;
- copiază rezultatul final într-un container Nginx.

Prin această structură, imaginea este "rețeta", containerul este instanța rulată, iar `docker-compose.yml` orchestrează toate containerele necesare aplicației.

## Django

Backend-ul implementează partea de API și persistență. Conceptele din curs apar direct în structura aplicației.

### Aplicații Django

În `backend/config/settings.py`, aplicațiile custom sunt adăugate în `INSTALLED_APPS`:

- `authentication`: model de utilizator și endpoint-uri de autentificare;
- `cv_processing`: upload, status, istoric și integrare RabbitMQ;
- `results`: stocarea rezultatului final al analizei.

Sunt folosite și pachete externe:

- `rest_framework` pentru API-uri REST;
- `corsheaders` pentru comunicarea frontend-backend din origini diferite;
- `rest_framework_simplejwt` pentru autentificare JWT.

### Modele

`authentication.models.User` extinde `AbstractUser` și impune `email` unic.

`cv_processing.models.CV` conține:

- relație `ForeignKey` către utilizator;
- fișierul uploadat;
- statusul procesării: `pending`, `processing`, `done`, `failed`;
- mesaj de eroare;
- `target_jobs` ca `JSONField`;
- indexuri pentru interogări rapide după user/status.

`results.models.Result` are relație `OneToOneField` cu `CV`, deoarece un CV are un singur rezultat final. Modelul stochează scorul de carieră, scorul de calitate, keyword-uri, job matches, recomandări și textul extras.

### View-uri și API

`backend/config/urls.py` mapează rutele principale:

- `/api/auth/` pentru autentificare;
- `/api/cv/` pentru upload, status, rezultat, istoric și delete;
- `/health/` pentru verificare simplă de disponibilitate.

`CVUploadView` primește request-ul `POST`, validează datele prin serializer, salvează CV-ul și publică mesajul în RabbitMQ. Dacă broker-ul nu este disponibil, statusul CV-ului devine `failed`, iar API-ul răspunde cu `503 Service Unavailable`.

`CVStatusView`, `CVResultView`, `CVHistoryView` și `CVDeleteView` expun operațiile necesare frontend-ului. Toate sunt protejate prin autentificare.

### Serializers

Serializers din DRF sunt folosite pentru validare și conversie între obiecte Python/Django și JSON:

- `CVUploadSerializer` acceptă doar `.pdf` și `.docx`, maxim 10 MB;
- `TargetJobsField` normalizează joburile țintă și limitează lista la 5 elemente;
- `ResultSerializer` expune toate câmpurile relevante pentru pagina de rezultat.

### Configurare

Setările sensibile sau dependente de mediu sunt citite din variabile de mediu:

- `DJANGO_SECRET_KEY`;
- `DJANGO_DEBUG`;
- `POSTGRES_*`;
- `RABBITMQ_URL`;
- `CV_QUEUE_NAME`;
- `CORS_ALLOWED_ORIGINS`.

Aceasta urmează ideea din cursul de Django Part 2: valorile sensibile sau diferite între medii nu sunt hardcodate în codul aplicației.

## RabbitMQ

RabbitMQ este folosit pentru decuplarea backend-ului de procesarea grea. API-ul trebuie să răspundă rapid la upload, iar analiza CV-ului poate dura mai mult deoarece implică parsare de documente, NLP și modele ML.

### Producer

Producer-ul este `backend/cv_processing/services/rabbitmq.py`.

La upload, backend-ul:

- construiește payload-ul JSON;
- deschide conexiune AMQP cu `pika.BlockingConnection`;
- declară coada `cv_processing` cu `durable=True`;
- publică mesajul pe exchange-ul default, folosind `routing_key=settings.CV_QUEUE_NAME`;
- setează `delivery_mode=pika.DeliveryMode.Persistent`, astfel mesajul este marcat ca persistent;
- încearcă publicarea de mai multe ori înainte să raporteze eroare.

### Broker

Broker-ul este serviciul `rabbitmq` din `docker-compose.yml`. Are:

- port `5672` pentru protocolul AMQP;
- port `15672` pentru RabbitMQ Management UI;
- user/parolă configurate prin variabile de mediu;
- healthcheck pentru pornire ordonată.

### Consumer

Consumer-ul este `worker/consumer.py`.

Acesta:

- se conectează la RabbitMQ și reîncearcă la 5 secunde dacă broker-ul nu este disponibil;
- declară aceeași coadă durabilă;
- folosește `basic_qos(prefetch_count=1)`, ca un worker să primească un mesaj nou doar după ce termină mesajul curent;
- procesează mesajul prin `CVProcessor`;
- salvează rezultatul în tranzacție;
- trimite `basic_ack` după procesare;
- re-publică mesajul cu header `x-retries` când apare o eroare recuperabilă;
- marchează CV-ul ca `failed` după depășirea numărului maxim de retry-uri.

Aceasta implementează traseul din curs: `Producer -> Exchange -> Queue -> Consumer`, cu ACK manual, persistență și control de distribuție prin prefetch.

## Multithreading

Multithreading-ul este implementat în `worker/processor.py`, în metoda `CVProcessor.process()`.

Pentru fiecare CV, worker-ul creează patru thread-uri:

| Thread | Responsabilitate | Dependență |
| --- | --- | --- |
| `extract_thread` | Extrage text din PDF/DOCX și calculează statistici | Nu depinde de alt thread |
| `keyword_thread` | Extrage keyword-uri TF-IDF | Așteaptă textul extras |
| `scoring_thread` | Calculează scorul de carieră și scorul de calitate | Așteaptă textul extras |
| `matching_thread` | Calculează potriviri cu joburi de referință și joburi țintă | Așteaptă textul extras |

### Sincronizare

Sunt folosite mecanismele discutate în curs:

- `threading.Thread`: creează unități de execuție separate în același proces worker;
- `start()`: pornește fiecare etapă;
- `join()`: blochează thread-ul principal până se termină toate etapele;
- `Lock`: protejează structura partajată `aggregate` și lista `errors`;
- `Event`: `text_ready` anunță thread-urile dependente că textul a fost extras;
- `Barrier(4)`: sincronizează cele patru thread-uri la finalul fazei lor.

Fără `Lock`, două thread-uri ar putea modifica simultan rezultatul agregat sau lista de erori. Fără `Event`, etapa de keyword extraction sau ML scoring ar putea porni înainte ca textul să existe. Fără `join()`, worker-ul ar putea încerca să salveze rezultatul înainte ca etapele să fie terminate.

În Python există GIL, deci thread-urile nu transformă automat codul CPU-bound în paralelism perfect pe mai multe core-uri. În acest proiect, thread-urile sunt utile pentru organizarea etapelor, pentru suprapunerea operațiilor de I/O și pentru separarea clară a responsabilităților în pipeline-ul de procesare.

## Machine Learning

Partea ML este în `worker/ml_model.py` și `worker/nlp_pipeline.py`.

### Date

Proiectul folosește două surse locale de date:

- `worker/data/job_descriptions.json`: joburi de referință, descrieri și categorii profesionale;
- `worker/data/cv_quality_training.json`: exemple etichetate pentru calitatea redactării CV-ului.

Aceste fișiere joacă rolul seturilor de date etichetate din învățarea supervizată.

### Preprocesare NLP

`TextPreprocessor` aplică:

- normalizare text;
- tokenizare cu NLTK;
- eliminare stopwords;
- filtrare token-uri irelevante;
- lematizare cu WordNet;
- transformare în document text curățat.

Această etapă reduce zgomotul și produce intrarea folosită de modelele TF-IDF.

### Extragere keyword-uri

`extract_keywords()` construiește documentul CV-ului și îl compară cu corpusul de joburi. Folosește:

- `TfidfVectorizer(max_features=5000, ngram_range=(1, 2))`;
- scorurile TF-IDF ale CV-ului;
- top keyword-uri ordonate descrescător după importanță.

Rezultatul este o listă de termeni relevanți, fiecare cu `term` și `weight`.

### Clasificare carieră

`CareerModel` antrenează la inițializare un pipeline scikit-learn:

```python
Pipeline(
    steps=[
        ("tfidf", TfidfVectorizer(max_features=5000, ngram_range=(1, 2), min_df=1)),
        ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced")),
    ]
)
```

Modelul primește descrierile joburilor ca text și categoriile ca etichete. La analiză, CV-ul este transformat în același spațiu de features, iar modelul produce probabilități pentru fiecare categorie profesională.

Regresia logistică este folosită aici pentru clasificare, exact ca în cursul de Machine Learning: deși numele conține "regresie", rezultatul este o probabilitate de apartenență la clasă.

### Embeddings semantice

`SemanticAnalyzer` folosește modelul `sentence-transformers/all-MiniLM-L6-v2`, dacă este activat prin `ENABLE_TRANSFORMER_MODELS=true`.

Rolul embeddings:

- transformă textul în vectori semantici;
- permit comparații dincolo de potrivirea exactă de cuvinte;
- calculează similaritatea prin produs scalar/cosine similarity;
- completează scorurile TF-IDF.

Pentru categoria profesională, proiectul combină:

- scor TF-IDF + Logistic Regression;
- scor semantic între CV și corpusul fiecărei categorii.

### Matching cu joburi

`match_jobs()` compară CV-ul cu joburile din `job_descriptions.json`.

`match_target_jobs()` compară CV-ul cu joburile introduse de utilizator și le completează cu cel mai apropiat job de referință.

Scorul de matching combină:

- similaritate lexicală TF-IDF;
- similaritate semantică prin embeddings;
- acoperire de termeni importanți;
- verdict de aliniere: `Strong signal`, `Good signal`, `Partial signal`, `Weak signal`.

### Scorul de carieră

Scorul final de carieră nu este doar probabilitatea brută a clasificatorului. `CareerModel._career_score_breakdown()` calculează mai multe semnale:

- încrederea categoriei;
- separarea față de categoria următoare;
- acoperirea vocabularului de rol;
- semnale explicite de skill;
- claritatea titlului/rolului țintă;
- rezultate măsurabile;
- profunzimea documentului.

Aceste semnale sunt combinate într-un scor 0-100 și într-un breakdown explicabil pentru frontend.

### Scorul de calitate CV

`CVQualityModel` antrenează un al doilea pipeline TF-IDF + Logistic Regression pe exemple etichetate `weak`, `average`, `strong`.

Scorul final combină:

- predicția modelului supervizat;
- scor semantic de calitate;
- verificări structurale: completitudine, secțiuni, bullet-uri, metrici, verbe de acțiune, claritate de rol și dovezi de skill.

Astfel, aplicația separă două întrebări:

- Cât de bine se potrivește CV-ul cu o direcție profesională?
- Cât de bine este redactat CV-ul ca document de recrutare?

## API Endpoints

Endpoint-urile nu folosesc trailing slash.

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/token/refresh
GET    /api/auth/me

POST   /api/cv/upload
GET    /api/cv/<cv_id>/status
GET    /api/cv/<cv_id>/result
DELETE /api/cv/<cv_id>
GET    /api/cv/history

GET    /health/
```

### Exemple De Răspunsuri

Upload acceptat:

```json
{
  "cv_id": 1,
  "status": "pending"
}
```

Rezultat încă indisponibil:

```json
{
  "cv_id": 1,
  "status": "processing",
  "error_message": "",
  "detail": "Result is not available yet."
}
```

## Rulare Cu Docker

Din rădăcina proiectului:

```bash
docker compose up --build
```

Pentru versiuni mai vechi de Docker Compose:

```bash
docker-compose up --build
```

Servicii expuse local:

| Serviciu | URL / port |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Health check | http://localhost:8000/health/ |
| RabbitMQ Management | http://localhost:15672 |
| RabbitMQ AMQP | localhost:5672 |
| PostgreSQL | localhost:5432 |

Credențiale RabbitMQ implicite:

```text
user: cv_user
password: cv_password
```

## Configurare

`.env.example` documentează variabilele folosite de backend și worker:

```text
DJANGO_SECRET_KEY=change-this-secret-in-production
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

POSTGRES_DB=cv_analyzer
POSTGRES_USER=cv_user
POSTGRES_PASSWORD=cv_password
POSTGRES_HOST=db
POSTGRES_PORT=5432

RABBITMQ_URL=amqp://cv_user:cv_password@rabbitmq:5672/%2F
CV_QUEUE_NAME=cv_processing

ENABLE_TRANSFORMER_MODELS=true
SENTENCE_TRANSFORMER_MODEL=sentence-transformers/all-MiniLM-L6-v2

WORKER_MAX_RETRIES=3
WORKER_PREFETCH=1
VITE_API_URL=http://localhost:8000/api
```

În `docker-compose.yml`, valorile de development sunt deja setate pentru rulare locală.

## Dezvoltare Locală Fără Docker

Pentru dezvoltare locală completă sunt necesare PostgreSQL și RabbitMQ pornite separat. Variabilele de mediu trebuie să indice către aceste servicii.

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

Worker:

```bash
pip install -r backend/requirements.txt -r worker/requirements.txt
python -m nltk.downloader punkt punkt_tab stopwords wordnet omw-1.4
python -m worker.consumer
```

În practică, varianta recomandată este Docker, deoarece pornește și configurează automat PostgreSQL, RabbitMQ, backend-ul, worker-ul și frontend-ul în aceeași rețea.

## Persistență Și Relații În Baza De Date

Modelele principale sunt:

```text
User 1 ─── n CV 1 ─── 1 Result
```

- Un utilizator poate încărca mai multe CV-uri.
- Fiecare CV aparține unui singur utilizator.
- Fiecare CV are cel mult un rezultat final.
- La ștergerea unui CV, rezultatul asociat este șters prin `on_delete=models.CASCADE`.

PostgreSQL este folosit în loc de SQLite pentru un setup mai apropiat de producție și pentru compatibilitate bună cu `JSONField`, tranzacții și volume persistente în Docker.

## Tratarea Erorilor

Proiectul tratează explicit mai multe cazuri:

- Upload invalid: serializer-ul respinge extensii nepermise, fișiere prea mari sau lipsa joburilor țintă.
- RabbitMQ indisponibil la publish: CV-ul este marcat `failed`, iar API-ul răspunde cu `503`.
- RabbitMQ indisponibil la worker start: consumer-ul reîncearcă periodic conexiunea.
- Eroare la procesare: mesajul este re-publicat cu `x-retries`, până la `WORKER_MAX_RETRIES`.
- CV șters între publish și consume: worker-ul ignoră mesajul vechi și trimite ACK.
- Salvare rezultat: se folosește `transaction.atomic()` și `select_for_update()` pentru consistență.

## Observații De Design

- Backend-ul rămâne responsive deoarece nu rulează ML în request-ul de upload.
- RabbitMQ decuplează producerea task-urilor de consumarea lor.
- Worker-ul poate fi scalat orizontal prin pornirea mai multor containere worker.
- `prefetch_count=1` evită ca un worker să primească multe task-uri grele simultan.
- Volumul `media_data` este montat atât în backend, cât și în worker, astfel worker-ul poate citi fișierele încărcate de backend.
- ML-ul este explicabil prin breakdown-uri și evidențe, nu doar printr-un scor numeric.
