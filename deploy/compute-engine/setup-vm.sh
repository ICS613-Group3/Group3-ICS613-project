#!/usr/bin/env bash
# ============================================================================
# setup-vm.sh — One-command provisioning script for Google Compute Engine
#
# Run this ON the new VM after SSH'ing in. It:
#   1. Updates the system and installs dependencies (PostgreSQL, Nginx, ...)
#   2. Creates a dedicated `toolsharing` system user
#   3. Clones the repo (or copies files from an uploaded tarball)
#   4. Sets up the Python virtual environment and installs dependencies
#   5. Builds the frontend (npm ci + npm run build)
#   6. Configures PostgreSQL (creates user, database)
#   7. Runs Alembic migrations
#   8. Installs systemd service + Nginx site
#
# Usage:
#   chmod +x setup-vm.sh
#   sudo ./setup-vm.sh
#
# Prerequisites:
#   - A Debian/Ubuntu VM on Google Compute Engine
#   - The application source already present at /opt/toolsharing/
#     (clone from GitHub or SCP the tarball — see DEPLOY_GCE.md)
#   - A .env.production file at /opt/toolsharing/.env with real secrets
# ============================================================================
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
APP_USER="toolsharing"
APP_DIR="/opt/toolsharing"
REPO_URL="https://github.com/rionhawaii/Group3-ICS613.git"
DB_NAME="toolsharing"
DB_USER="ics613user"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERR]${NC} $*" >&2; }

# ── Sanity checks ───────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "This script must be run as root (sudo ./setup-vm.sh)"
    exit 1
fi

if [[ ! -f "${APP_DIR}/.env" ]]; then
    err ".env file not found at ${APP_DIR}/.env"
    err "Create it from deploy/compute-engine/.env.production before running this script."
    exit 1
fi

# shellcheck source=/dev/null
source "${APP_DIR}/.env"

# ── Step 1: System dependencies ──────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

info "Installing PostgreSQL, Nginx, Python, Node.js, and build tools..."
apt-get install -y -qq \
    postgresql postgresql-contrib \
    nginx \
    python3 python3-venv python3-pip \
    libpq-dev \
    git curl

# Install Node.js 22.x (LTS) if not already present
if ! command -v node &>/dev/null; then
    info "Installing Node.js 22.x..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
fi

if ! command -v npm &>/dev/null; then
    apt-get install -y -qq npm
fi

info "System packages installed."

# ── Step 2: Create system user ──────────────────────────────────────────────
if id "${APP_USER}" &>/dev/null; then
    info "User ${APP_USER} already exists."
else
    info "Creating system user ${APP_USER}..."
    useradd --system --no-create-home --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

# ── Step 3: Clone / sync application source ─────────────────────────────────
if [[ -d "${APP_DIR}/.git" ]]; then
    info "Repo already cloned. Pulling latest..."
    cd "${APP_DIR}"
    sudo -u "${APP_USER}" git pull
elif [[ -d "${APP_DIR}/backend" ]]; then
    info "Source directory already present at ${APP_DIR} (skipping clone)."
else
    info "Cloning repository from ${REPO_URL}..."
    git clone "${REPO_URL}" "${APP_DIR}-tmp"
    shopt -s dotglob
    mv "${APP_DIR}-tmp"/* "${APP_DIR}/"
    shopt -u dotglob
    rmdir "${APP_DIR}-tmp" 2>/dev/null || true
fi

# Ensure correct ownership
chown -R "${APP_USER}":"${APP_USER}" "${APP_DIR}"

# ── Step 4: Backend setup ───────────────────────────────────────────────────
info "Setting up Python virtual environment..."
cd "${APP_DIR}/backend"

if [[ ! -d venv ]]; then
    python3 -m venv venv
fi
chown -R "${APP_USER}":"${APP_USER}" venv

info "Installing Python dependencies..."
sudo -u "${APP_USER}" ./venv/bin/pip install --quiet --upgrade pip
sudo -u "${APP_USER}" ./venv/bin/pip install --quiet -r requirements.txt

# Copy .env to backend dir (the backend reads it from cwd)
cp "${APP_DIR}/.env" "${APP_DIR}/backend/.env"

# Ensure ENVIRONMENT=development is set (required for dev SECRET_KEY)
if ! grep -q "^ENVIRONMENT=" "${APP_DIR}/backend/.env"; then
    echo "ENVIRONMENT=development" >> "${APP_DIR}/backend/.env"
fi
chown "${APP_USER}":"${APP_USER}" "${APP_DIR}/backend/.env"

info "Backend dependencies installed."

# ── Step 5: Frontend build ──────────────────────────────────────────────────
info "Building frontend..."
cd "${APP_DIR}/frontend"

# Create frontend .env for production
cat > .env << FRONTEND_ENV
VITE_API_BASE_URL=/api/v1
VITE_API_TARGET=
VITE_USE_MOCKS=false
FRONTEND_ENV

if [[ ! -d node_modules ]]; then
    sudo -u "${APP_USER}" npm install --silent 2>/dev/null || npm install --silent
fi
sudo -u "${APP_USER}" npm run build 2>&1

info "Frontend built at ${APP_DIR}/frontend/dist"

# ── Step 6: PostgreSQL setup ────────────────────────────────────────────────
info "Configuring PostgreSQL..."
pg_ctlcluster 16 main start 2>/dev/null || pg_ctlcluster 15 main start 2>/dev/null || true

# Extract DB password from .env (strip prefix)
DB_PASS="${DATABASE_URL#*://${DB_USER}:}"
DB_PASS="${DB_PASS%%@*}"
DB_PASS="${DB_PASS%%:*}"

if [[ "${DB_PASS}" == "${DATABASE_URL}" ]]; then
    # Fallback: password wasn't extractable, use a generated one
    DB_PASS="$(openssl rand -base64 18)"
    warn "Could not extract DB password from DATABASE_URL. Generated: ${DB_PASS}"
fi

sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || \
    info "PostgreSQL user ${DB_USER} already exists."
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
    info "Database ${DB_NAME} already exists."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# Allow password login (edit pg_hba.conf)
PG_HBA=$(find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1)
if [[ -n "${PG_HBA}" ]]; then
    # Change local and TCP connections from peer/scram-sha-256 to md5 for our user
    sed -i 's/local\s\+all\s\+all\s\+peer/local   all             all                                     md5/' "${PG_HBA}"
    if ! grep -q "${DB_USER}" "${PG_HBA}"; then
        echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    md5" >> "${PG_HBA}"
    fi
    pg_ctlcluster 16 main reload 2>/dev/null || pg_ctlcluster 15 main reload 2>/dev/null || true
fi

info "PostgreSQL configured."

# ── Step 7: Create database tables ───────────────────────────────────────────
info "Creating database tables from ORM models..."
cd "${APP_DIR}/backend"
sudo -u "${APP_USER}" PYTHONPATH="${APP_DIR}/backend/src" ./venv/bin/python scripts/init_db.py
info "Database tables created."

# ── Step 8: Install systemd service ─────────────────────────────────────────
info "Installing systemd service..."
cp "${APP_DIR}/deploy/compute-engine/toolsharing-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable toolsharing-backend
systemctl start toolsharing-backend
info "Backend service started."

# ── Step 9: Install Nginx site ──────────────────────────────────────────────
info "Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default

# Create static root and copy frontend build
mkdir -p /var/www/toolsharing
cp -r "${APP_DIR}/frontend/dist/"* /var/www/toolsharing/
chown -R www-data:www-data /var/www/toolsharing

# Install Nginx config
cp "${APP_DIR}/deploy/compute-engine/toolsharing-nginx.conf" /etc/nginx/sites-available/toolsharing
ln -sf /etc/nginx/sites-available/toolsharing /etc/nginx/sites-enabled/

# Test and reload
nginx -t
systemctl reload nginx
info "Nginx configured."

# ── Step 10: Create media directory ─────────────────────────────────────────
info "Creating media uploads directory..."
mkdir -p "${APP_DIR}/backend/media/tool_photos"
chown -R "${APP_USER}":"${APP_USER}" "${APP_DIR}/backend/media"

# ── Done ─────────────────────────────────────────────────────────────────────
VM_IP=$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H "Metadata-Flavor: Google" 2>/dev/null || echo "<EXTERNAL_IP>")

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}======================================================${NC}"
echo ""
echo "  Frontend:  http://${VM_IP}/"
echo "  API docs:  http://${VM_IP}/api/v1/health"
echo "  OpenAPI:   http://${VM_IP}/docs"
echo ""
echo "  Admin login (seed):"
echo "    Email:    admin@example.com"
echo "    Password: (set via SEED_PASSWORD in .env)"
echo ""
echo "  To check service status:"
echo "    sudo systemctl status toolsharing-backend"
echo "    sudo journalctl -u toolsharing-backend -n 50 --no-pager"
echo ""
echo "  To view logs:"
echo "    sudo journalctl -u toolsharing-backend -f"
echo ""
echo -e "${YELLOW}  IMPORTANT:${NC}"
echo "  - Set up a domain and HTTPS (Certbot) for production use"
echo "  - Change the SECRET_KEY and DB password if using defaults"
echo "  - Disable password auth in PostgreSQL if not needed"
echo "======================================================"
