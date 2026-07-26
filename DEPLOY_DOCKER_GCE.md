# Docker Deployment Guide — Google Compute Engine

Deploy the **Neighborhood Tool Sharing** app to Google Cloud using Docker
Compose. PostgreSQL, the FastAPI backend, and the React frontend (served by
Nginx) each run in their own container.

> **Who is this for?** QA team members, new contributors, or anyone who wants
> to deploy the app and learn GCP. You only need a Google account and basic
> terminal skills.

---

## What you will learn

- Create a VM on Google Compute Engine
- Install Docker and Docker Compose on a Linux server
- Write a Dockerfile for the frontend (multi-stage: Node build → Nginx serve)
- Write a `docker-compose.yml` that orchestrates three services
- Configure Nginx to proxy API calls to the backend container
- Run database migrations and seed demo data
- Redeploy after a PR is merged

---

## Prerequisites

| What you need | How to get it |
|---|---|
| **Google Cloud account** with billing | [cloud.google.com](https://cloud.google.com) — free $300 credit for new accounts |
| **Google Cloud SDK (`gcloud`)** on your machine | [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) |
| **A Git checkout** of the repo | `git clone -b Integrated_frontend_backend https://github.com/ICS613-Group3/Group3-ICS613-project.git` |
| **A generated SECRET_KEY** | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| **A Gmail App Password** (for sending emails) | See section below |

---

## Step 1: Create the VM

```bash
# 1a. Set your GCP project (create one in the GCP Console first).
gcloud config set project YOUR_PROJECT_ID

# 1b. Create the VM.
#     e2-medium (2 vCPU, 4 GB) is enough.
gcloud compute instances create toolsharing-docker \
    --zone=us-west1-a \
    --machine-type=e2-medium \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --tags=http-server

# 1c. Allow HTTP traffic.
gcloud compute firewall-rules create allow-http \
    --allow tcp:80 --target-tags=http-server \
    --description="Allow HTTP traffic"

# 1d. Get the VM's external IP address.
gcloud compute instances describe toolsharing-docker \
    --zone=us-west1-a \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

**Save that IP** — you will need it in Step 4.

---

## Step 2: SSH into the VM

```bash
gcloud compute ssh toolsharing-docker --zone=us-west1-a
```

From this point, every command runs **inside the VM** unless noted otherwise.

---

## Step 3: Install Docker and Docker Compose

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker using the official Ubuntu repository
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to the docker group (so you don't need sudo).
sudo usermod -aG docker $USER
```

**Log out and back in** for the group change to take effect:

```bash
exit
# then SSH again
gcloud compute ssh toolsharing-docker --zone=us-west1-a

# Verify
docker --version
docker compose version
```

---

## Step 4: Clone the repo and understand the structure

```bash
git clone -b Integrated_frontend_backend https://github.com/ICS613-Group3/Group3-ICS613-project.git ~/Group3-ICS613
cd ~/Group3-ICS613
```

Look at what we already have:

| Path | What it is |
|---|---|
| `backend/Dockerfile` | Multi-stage Dockerfile for the FastAPI backend (already exists!) |
| `backend/src/app/` | Backend Python code |
| `frontend/` | React app with `package.json` and `vite.config.ts` |
| `deploy/compute-engine/` | Existing non-Docker deployment scripts (we will not use these) |

We need to create three files ourselves. The backend Dockerfile already exists
in the repo, but we need to write a frontend Dockerfile and a docker-compose.yml
from scratch as a learning exercise.

---

## Step 5: Create the files for Docker deployment

### 5a. Create `frontend/Dockerfile`

This is a **multi-stage build**. Stage 1 compiles the React app, Stage 2 serves
the compiled files with Nginx.

```bash
nano frontend/Dockerfile
```

Paste this content:

```dockerfile
# syntax=docker/dockerfile:1

# ── Builder stage: compile React with Vite ──
FROM node:22-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage: serve with Nginx ──
FROM nginx:alpine

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

### 5b. Create `frontend/nginx.conf`

This tells Nginx to serve the React static files and forward `/api/` and
`/uploads/` requests to the backend container (which will be reachable by the
Docker service name `backend`).

```bash
nano frontend/nginx.conf
```

Paste this:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # API requests go to the backend container
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 6m;
    }

    # Tool photo uploads
    location /uploads/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 6m;
    }

    # API docs
    location /docs {
        proxy_pass http://backend:8000;
    }
    location /openapi.json {
        proxy_pass http://backend:8000;
    }

    # SPA fallback: let React Router handle client-side routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
    gzip_vary on;
}
```

Save and exit.

### 5c. Create `docker-compose.yml` at the project root

```bash
nano docker-compose.yml
```

Paste this:

```yaml
name: tool-share

services:

  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: ics613user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: toolsharing
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ics613user -d toolsharing"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+asyncpg://ics613user:${POSTGRES_PASSWORD}@db:5432/toolsharing
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - media_data:/app/media
    networks:
      - app-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "${FRONTEND_PORT:-80}:80"
    depends_on:
      - backend
    networks:
      - app-network

volumes:
  postgres_data:
  media_data:

networks:
  app-network:
    driver: bridge
```

Save and exit.

### 5d. Create `.env` for your secrets

```bash
nano .env
```

Paste this template, then fill in your real values:

```bash
# ── Database password ──
POSTGRES_PASSWORD=<generate a strong password>

# ── Security ──
SECRET_KEY=<use: python3 -c "import secrets; print(secrets.token_urlsafe(48))">

# ── CORS ──
CORS_ORIGINS=http://<YOUR_VM_EXTERNAL_IP>

# ── Email (SMTP) ──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=ics613.group3@gmail.com
SMTP_PASSWORD=<your Gmail App Password>
SMTP_TLS=true
SMTP_FROM=noreply@toolsharing.local

# ── Frontend URLs for email links ──
VERIFY_URL_BASE=http://<YOUR_VM_EXTERNAL_IP>/verify-email
PASSWORD_RESET_URL_BASE=http://<YOUR_VM_EXTERNAL_IP>/reset-password

# ── App ──
DISABLE_SCHEDULER=false
```

The password must **not** contain `@` or `:` characters (they would break the
URL). Generate one with:

```bash
openssl rand -base64 24
```

---

### Gmail App Password

The app sends emails (invites, password resets) via SMTP.

1. Go to https://myaccount.google.com/apppasswords
2. Sign in as **ics613.group3@gmail.com**
3. Under "Select app", choose **Mail**
4. Under "Select device", choose **Other (Custom name)** → type `toolsharing-docker`
5. Click **Generate**
6. Copy the 16-character password (looks like `abcd efgh ijkl mnop`)
7. Paste it into `SMTP_PASSWORD` in `.env` — remove the spaces

If you just want to test the deployment without email, leave `SMTP_PASSWORD`
as-is. The app logs SMTP errors but does not crash.

---

## Step 6: Build and start the containers

```bash
docker compose up -d
```

Docker will:
1. Pull the `postgres:15` image
2. Build the backend image (installs Python deps)
3. Build the frontend image (`npm ci && npm run build`, then wraps in Nginx)
4. Create a network and start all three containers

**Watch the startup logs:**

```bash
docker compose logs -f
```

Wait until you see something like:
```
backend  | INFO  ... Application startup complete.
backend  | INFO  ... Uvicorn running on http://0.0.0.0:8000
```

Press `Ctrl+C` to stop following logs.

---

## Step 7: Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

Expected output: `INFO  [alembic.runtime.migration] Running upgrade ...`

---

## Step 8: Verify the deployment

### Health check

```bash
curl http://localhost/api/v1/health
```

Expected:
```json
{"status":"ok"}
```

### Open in browser

Navigate to **http://<YOUR_VM_EXTERNAL_IP>/** — you should see the login page.

### API docs

Open **http://<YOUR_VM_EXTERNAL_IP>/docs** — Swagger UI with all endpoints.

---

## Step 9: (Optional) Seed demo data

```bash
docker compose exec backend python scripts/seed_dev.py -p DemoPass123
```

Then log in at `http://<VM_IP>/login` with:
- **Admin:** `admin@example.com` / `DemoPass123`
- **Member 01:** `member01@example.com` / `DemoPass123`
- **Member 02:** `member02@example.com` / `DemoPass123`

---

## Step 10: (Optional) HTTPS with Certbot

For a real deployment you need a domain name. The simplest approach for this
project is:

```bash
# Install Nginx on the host (not in the container)
sudo apt-get install -y nginx
sudo certbot --nginx -d yourdomain.com
```

Then configure the host Nginx to reverse-proxy to `http://localhost:80`
(where the Docker frontend container listens). For QA testing, HTTP is fine.

---

## Everyday commands

| What | Command |
|---|---|
| See running containers | `docker compose ps` |
| View all logs | `docker compose logs -f` |
| View backend logs | `docker compose logs -f backend` |
| Restart a service | `docker compose restart backend` |
| Stop everything | `docker compose down` |
| Stop + delete data | `docker compose down -v` |

---

## Redeploy after a PR merge

```bash
cd ~/Group3-ICS613
git pull
docker compose up -d --build
docker compose exec backend alembic upgrade head
curl http://localhost/api/v1/health
```

The `--build` flag rebuilds only images whose source changed. To rebuild only
the backend: `docker compose up -d --build backend`.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` | Backend not started | `docker compose logs backend` |
| `relation "users" not found` | Migrations not run | `docker compose exec backend alembic upgrade head` |
| `Connection refused` to DB | PostgreSQL not healthy | `docker compose logs db` |
| CORS error in browser | Wrong `CORS_ORIGINS` in `.env` | Update `.env` and `docker compose restart backend` |
| Frontend shows blank page | Build failed | `docker compose logs frontend` |

---

## Architecture diagram

```
                         ┌─────────────┐
                         │   Browser   │
                         └──────┬──────┘
                                │ :80
                    ┌───────────┴───────────┐
                    │  frontend (Nginx)      │
                    │  Serves React static   │
                    │  files + proxy /api/*  │
                    └───────────┬───────────┘
                                │ http://backend:8000
                    ┌───────────┴───────────┐
                    │  backend (FastAPI)     │
                    │  Port 8000             │
                    └───────────┬───────────┘
                                │ postgresql+asyncpg://db:5432
                    ┌───────────┴───────────┐
                    │  db (PostgreSQL 15)    │
                    │  Port 5432             │
                    └───────────────────────┘

All three containers are on a single Docker bridge network (app-network).
They communicate by Docker service name (db, backend, frontend).
```

---

## Quick reference — deploy from scratch

Here is every command in order, ready to paste:

**On your local machine:**
```bash
gcloud config set project YOUR_PROJECT_ID
gcloud compute instances create toolsharing-docker \
    --zone=us-west1-a --machine-type=e2-medium \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB --tags=http-server
gcloud compute firewall-rules create allow-http \
    --allow tcp:80 --target-tags=http-server
gcloud compute ssh toolsharing-docker --zone=us-west1-a
```

**Inside the VM:**
```bash
# Docker
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
exit

# SSH back in
gcloud compute ssh toolsharing-docker --zone=us-west1-a

# Clone repo
git clone -b Integrated_frontend_backend https://github.com/ICS613-Group3/Group3-ICS613-project.git ~/Group3-ICS613
cd ~/Group3-ICS613

# Create files (see Steps 5a-5d above for content)
nano frontend/Dockerfile
nano frontend/nginx.conf
nano docker-compose.yml
nano .env

# Deploy
docker compose up -d
docker compose exec backend alembic upgrade head
curl http://localhost/api/v1/health
```

---

## Cost

`e2-medium` running 24/7 ≈ **$25–30/month**. Stop when not in use:

```bash
gcloud compute instances stop toolsharing-docker --zone=us-west1-a
gcloud compute instances start toolsharing-docker --zone=us-west1-a
```
