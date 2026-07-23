# Google Compute Engine Deployment Guide

Deploy the **Neighborhood Tool Sharing** app to a single Google Compute Engine VM.
Everything runs on one machine: PostgreSQL, the FastAPI backend, and the React
frontend served via Nginx.

---

## Prerequisites

| Requirement | How to get it |
|---|---|
| **Google Cloud account** with billing enabled | [cloud.google.com](https://cloud.google.com) — free $300 credit for new accounts |
| **Google Cloud SDK (`gcloud`)** installed locally | [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) |
| **A Git checkout** of this repo | `git clone https://github.com/rionhawaii/Group3-ICS613.git` |
| **A generated SECRET_KEY** | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| **(Optional) Gmail App Password** for SMTP | See section below |

---

## Step 1: Create the VM

Pick a machine type. For a demo / moderate load, `e2-medium` (2 vCPU, 4 GB RAM)
is plenty. The setup script works on **Debian 12** or **Ubuntu 22.04/24.04**.

```bash
# Set your project (create one in the GCP Console first)
gcloud config set project YOUR_PROJECT_ID

# Create the VM
gcloud compute instances create toolsharing-app \
    --zone=us-west1-a \
    --machine-type=e2-medium \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --tags=http-server,https-server \
    --network-interface=network-tier=PREMIUM,stack-type=IPV4_ONLY,subnet=default

# Allow HTTP and HTTPS traffic
gcloud compute firewall-rules create allow-http \
    --allow tcp:80 --target-tags=http-server --description="Allow HTTP"

gcloud compute firewall-rules create allow-https \
    --allow tcp:443 --target-tags=https-server --description="Allow HTTPS"

# Get the external IP
gcloud compute instances describe toolsharing-app \
    --zone=us-west1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

---

## Step 2: Prepare the .env file

Copy and edit the production env template with real values:

```bash
cp deploy/compute-engine/.env.production .env
```

**Every field you must change (marked ★ in the template):**

| Variable | What to set |
|---|---|
| `DATABASE_URL` | Change `★CHANGE_ME★` to a strong password for the DB user |
| `SECRET_KEY` | Replace with output from `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | Replace `★YOUR_VM_EXTERNAL_IP★` with the VM's external IP from Step 1 |
| `SMTP_USER` | Your Gmail address (or SendGrid API key username) |
| `SMTP_PASSWORD` | Gmail App Password or SendGrid API key |

> **Gmail App Password**: Enable 2FA on your Google account, then go to
> https://myaccount.google.com/apppasswords and generate one for "Mail".

---

## Step 3: Upload files to the VM

Option A — **SCP the whole repo** (simplest):

```bash
# Upload the project
gcloud compute scp --recurse --zone=us-west1-a \
    $(pwd) toolsharing-app:~/

# SSH in and move it to /opt
gcloud compute ssh toolsharing-app --zone=us-west1-a -- \
    "sudo mkdir -p /opt/toolsharing && \
     sudo mv ~/Group3-ICS613 /opt/toolsharing/app && \
     sudo chown -R toolsharing:toolsharing /opt/toolsharing 2>/dev/null || true"
```

Wait — the setup-vm.sh expects the source at `/opt/toolsharing/` with the
`backend/` and `frontend/` directories at the top level. If you clone directly
on the VM, that's automatic. If you SCP, make sure the structure is:

```
/opt/toolsharing/
├── .env                     ← your production env file
├── backend/
├── frontend/
└── deploy/
    └── compute-engine/
        ├── setup-vm.sh
        ├── toolsharing-backend.service
        ├── toolsharing-nginx.conf
        └── .env.production
```

Option B — **Clone directly on the VM** (recommended):

```bash
gcloud compute ssh toolsharing-app --zone=us-west1-a

# Inside the VM:
sudo mkdir -p /opt/toolsharing
sudo chown $USER:$USER /opt/toolsharing
git clone https://github.com/rionhawaii/Group3-ICS613.git /opt/toolsharing
```

Then upload only the `.env` file:

```bash
gcloud compute scp --zone=us-west1-a .env toolsharing-app:/opt/toolsharing/.env
```

---

## Step 4: Create the DB password secret

Generate a strong password and put it in `.env`. The setup script uses it:

```bash
# On your local machine:
DB_PASS=$(openssl rand -base64 24)
# Edit .env and replace both ★CHANGE_ME★ in DATABASE_URL with this password
```

Then re-upload `.env` as shown above.

> The setup script creates a PostgreSQL user and database with the credentials
> from `DATABASE_URL`. Make sure the password contains no `@` or `:` characters
> (they would break the URL parsing).

---

## Step 5: Run the setup script

SSH into the VM and run the provisioning script:

```bash
gcloud compute ssh toolsharing-app --zone=us-west1-a

# Inside the VM:
sudo chmod +x /opt/toolsharing/deploy/compute-engine/setup-vm.sh
sudo /opt/toolsharing/deploy/compute-engine/setup-vm.sh
```

The script will:
1. Install system packages (PostgreSQL, Nginx, Python, Node.js)
2. Create the `toolsharing` system user
3. Install Python dependencies in a venv
4. Build the frontend with `npm run build`
5. Configure PostgreSQL (creates user & database)
6. Create database tables (init_db.py)
7. Start the FastAPI backend as a systemd service
8. Configure Nginx to serve the frontend and proxy API calls

**Expected duration:** 3–5 minutes. If it fails, check the error message and
ensure the `.env` file is present with valid values.

---

## Step 6: Verify

### Backend health check

```bash
curl http://localhost:8000/api/v1/health
# Expected: {"status":"ok"}
```

### Frontend

Open `http://<VM_EXTERNAL_IP>/` in a browser. You should see the login page.

### Check service logs

```bash
sudo journalctl -u toolsharing-backend -n 50 --no-pager
```

### API documentation

Open `http://<VM_EXTERNAL_IP>/docs` in a browser.

---

## Step 7: (Optional) Seed demo data

If you want demo users and tools to test with:

```bash
sudo -u toolsharing bash -c "cd /opt/toolsharing/backend && \
    SEED_PASSWORD=devpass123 ./venv/bin/python scripts/seed_dev.py"
```

Then log in at `http://<VM_IP>/login` with `admin@example.com` / `devpass123`.

> **⚠ Security warning:** Remove seed data or change passwords immediately for
> any production-facing deployment. Seed users have simple passwords.

---

## Step 8: Set up HTTPS with Certbot

```bash
# SSH into the VM
sudo apt-get install -y snapd
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot

# Get a certificate (requires a domain name pointing to the VM's IP)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up by default. Test it:
sudo certbot renew --dry-run
```

Before running Certbot, update the `server_name` in
`/opt/toolsharing/deploy/compute-engine/toolsharing-nginx.conf` from `_` to your actual domain.

---

## Maintenance

### Update the app

```bash
gcloud compute ssh toolsharing-app --zone=us-west1-a
cd /opt/toolsharing

# Pull latest code
sudo git pull

# Backend: install new deps + re-create tables on schema change
cd backend
sudo -u toolsharing ./venv/bin/pip install -r requirements.txt
sudo -u toolsharing PYTHONPATH=src ./venv/bin/python scripts/init_db.py
sudo systemctl restart toolsharing-backend

> **Note:** `init_db.py` creates tables with `CREATE TABLE IF NOT EXISTS`. If you changed an existing column/constraint, you must first drop and re-create: `sudo -u toolsharing ./venv/bin/python scripts/clean_dev.py && sudo -u toolsharing PYTHONPATH=src ./venv/bin/python scripts/init_db.py` (this wipes all data).

# Frontend: rebuild
cd ../frontend
sudo -u toolsharing npm install
sudo -u toolsharing npm run build
sudo cp -r dist/* /var/www/toolsharing/
```

### View backend logs

```bash
sudo journalctl -u toolsharing-backend -f
```

### View Nginx logs

```bash
sudo tail -f /var/log/nginx/toolsharing-access.log
sudo tail -f /var/log/nginx/toolsharing-error.log
```

### Backup the database

```bash
sudo -u postgres pg_dump toolsharing > toolsharing-backup-$(date +%F).sql
```

### Stop / start the VM (saves costs)

```bash
gcloud compute instances stop toolsharing-app --zone=us-west1-a
gcloud compute instances start toolsharing-app --zone=us-west1-a
```

---

## Architecture

```
Internet ──► Nginx (:80)
               │
               ├── / → /var/www/toolsharing/* (static React build)
               │       └── SPA fallback → index.html
               │
               ├── /api/*          ──► proxy_pass 127.0.0.1:8000
               ├── /uploads/*      ──► proxy_pass 127.0.0.1:8000
               └── /docs, /openapi.json ──► proxy_pass 127.0.0.1:8000
                                          │
                                    FastAPI (systemd)
                                          │
                                    PostgreSQL (localhost:5432)
```

All components on a single VM — no Cloud SQL, no load balancer. Simple to
manage and costs ~$25/month for an e2-medium.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Nginx 502 Bad Gateway | Backend not running | `sudo systemctl status toolsharing-backend` |
| `relation "users" does not exist` | Database tables not created | `cd /opt/toolsharing/backend && sudo -u toolsharing PYTHONPATH=src ./venv/bin/python scripts/init_db.py` |
| Connection refused to PostgreSQL | PostgreSQL not running | `sudo systemctl status postgresql` |
| CORS error in browser | `CORS_ORIGINS` missing the domain | Update `.env` and restart backend |
| 403 Forbidden on /uploads | Media directory not created | `sudo mkdir -p /opt/toolsharing/backend/media/tool_photos && sudo chown -R toolsharing:toolsharing /opt/toolsharing/backend/media` |
| Frontend shows blank page | Build failed or dist not copied | Check `npm run build` output, verify `/var/www/toolsharing/index.html` exists |
