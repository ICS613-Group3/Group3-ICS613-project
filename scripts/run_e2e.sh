#!/usr/bin/env bash
# ============================================================================
# E2E Test Runner — Neighborhood Tool Sharing
#
# Orchestrates the full stack (PostgreSQL + Backend + Frontend) and runs the
# E2E test suite against a real environment.
#
# Usage:
#   chmod +x scripts/run_e2e.sh
#   ./scripts/run_e2e.sh
#
# Options:
#   --no-cleanup   Leave containers running after tests complete
#   --ci           CI mode (skip password prompt, no color)
#   --build        Rebuild the frontend before testing
#   --help         Show this help
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# ── Parse args ────────────────────────────────────────────────────────────
NO_CLEANUP=false
CI_MODE=false
REBUILD_FRONTEND=false

for arg in "$@"; do
    case "$arg" in
        --no-cleanup) NO_CLEANUP=true ;;
        --ci)         CI_MODE=true ;;
        --build)      REBUILD_FRONTEND=true ;;
        --help)
            sed -n '2,18p' "$0"
            exit 0
            ;;
    esac
done

# ── Colors ────────────────────────────────────────────────────────────────
if [[ "$CI_MODE" == "true" ]]; then
    GREEN=""; RED=""; YELLOW=""; CYAN=""; BOLD=""; RESET=""
else
    GREEN="\033[92m"; RED="\033[91m"; YELLOW="\033[93m"
    CYAN="\033[96m"; BOLD="\033[1m"; RESET="\033[0m"
fi

info()  { echo -e "${CYAN}[E2E]${RESET} $*"; }
ok()    { echo -e "${GREEN}[  OK]${RESET} $*"; }
fail()  { echo -e "${RED}[FAIL]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET} $*"; }
header(){ echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }

# ── Pre-flight checks ─────────────────────────────────────────────────────
header "Pre-flight Checks"

# Check Docker
if ! command -v docker &>/dev/null; then
    fail "Docker is not installed. Please install Docker first."
    exit 1
fi
ok "Docker is available"

if ! docker info &>/dev/null; then
    fail "Docker daemon is not running. Start Docker Desktop or the docker service."
    exit 1
fi
ok "Docker daemon is running"

# Check Python venv
VENV_DIR="$PROJECT_ROOT/backend/venv"
if [[ ! -d "$VENV_DIR" ]]; then
    warn "No venv found at $VENV_DIR — creating one..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --upgrade pip -q
    "$VENV_DIR/bin/pip" install -r "$PROJECT_ROOT/backend/requirements.txt" -q
    ok "Virtual environment created and dependencies installed"
else
    ok "Virtual environment found"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

# ── Step 1: Start PostgreSQL ──────────────────────────────────────────────
header "Starting PostgreSQL Container"

export COMPOSE_FILE="$PROJECT_ROOT/backend/docker-compose.yml"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# Check if already running
if docker compose ps --status running 2>/dev/null | grep -q "db.*Up"; then
    ok "PostgreSQL is already running"
else
    info "Starting PostgreSQL..."
    docker compose up -d db
    ok "PostgreSQL container started"
fi

# Wait for PostgreSQL to be healthy
info "Waiting for PostgreSQL to become healthy..."
for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U ics613user -d toolsharing &>/dev/null; then
        ok "PostgreSQL is accepting connections"
        break
    fi
    if [[ "$i" -eq 30 ]]; then
        fail "PostgreSQL did not become healthy within 30 seconds"
        docker compose logs db --tail 20
        exit 1
    fi
    sleep 1
done

# Wait a bit more for the init script to create the test DB
sleep 2

# ── Step 2: Configure Environment ─────────────────────────────────────────
header "Configuring Environment"

export DATABASE_URL="postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing"
export TEST_DATABASE_URL="postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing_test"
export SECRET_KEY="e2e-test-secret-key-at-least-32-chars-long-!!"
export DISABLE_SCHEDULER="true"
export ENVIRONMENT="development"

# Set up .env for the backend if not already set
cat > "$PROJECT_ROOT/backend/.env" << EOF
DATABASE_URL=${DATABASE_URL}
TEST_DATABASE_URL=${TEST_DATABASE_URL}
SECRET_KEY=${SECRET_KEY}
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
DISABLE_SCHEDULER=true
ENVIRONMENT=development
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_TLS=false
SMTP_FROM=noreply@toolsharing.local
SEED_PASSWORD=E2eTestPass123!
SKIP_SEED_PASSWORD_PRINT=1
EOF
ok "Environment configured"

# ── Step 3: Apply Migrations ──────────────────────────────────────────────
header "Running Database Migrations"

cd "$PROJECT_ROOT/backend"

info "Dropping all tables (fresh start)..."
PYTHONPATH=src "$VENV_DIR/bin/python" -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def reset():
    engine = create_async_engine('${DATABASE_URL}')
    async with engine.connect() as conn:
        await conn.execute(text('DROP SCHEMA public CASCADE'))
        await conn.execute(text('CREATE SCHEMA public'))
        await conn.execute(text('GRANT ALL ON SCHEMA public TO ics613user'))
        await conn.execute(text('GRANT ALL ON SCHEMA public TO public'))
        await conn.commit()
    await engine.dispose()
    # Also reset test DB
    engine2 = create_async_engine('${TEST_DATABASE_URL}')
    async with engine2.connect() as conn:
        await conn.execute(text('DROP SCHEMA public CASCADE'))
        await conn.execute(text('CREATE SCHEMA public'))
        await conn.execute(text('GRANT ALL ON SCHEMA public TO ics613user'))
        await conn.execute(text('GRANT ALL ON SCHEMA public TO public'))
        await conn.commit()
    await engine2.dispose()

asyncio.run(reset())
print('Schema reset complete')
" 2>&1 || {
    warn "Schema reset may have failed — continuing anyway"
}
ok "Database schema reset"

info "Running Alembic migrations..."
PYTHONPATH=src "$VENV_DIR/bin/alembic" upgrade head 2>&1 || {
    fail "Migration failed"
    echo "--- Migration output above ---"
    exit 1
}
ok "Database migrations applied"

# ── Step 4: Seed Demo Data ────────────────────────────────────────────────
header "Seeding Demo Data"

info "Running seed script..."
PYTHONPATH=src "$VENV_DIR/bin/python" scripts/seed_dev.py 2>&1 || {
    fail "Seed script failed"
    exit 1
}
ok "Demo data seeded"

# ── Step 5: Start Backend Server ──────────────────────────────────────────
header "Starting Backend Server"

# Kill any existing uvicorn on port 8000
if lsof -ti:8000 &>/dev/null 2>&1; then
    warn "Port 8000 is in use — stopping existing process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

info "Starting FastAPI backend on http://127.0.0.1:8000..."
PYTHONPATH=src nohup "$VENV_DIR/bin/python" run.py --host 127.0.0.1 --port 8000 \
    > "$PROJECT_ROOT/backend/.e2e-backend.log" 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Wait for backend to be ready
info "Waiting for backend to accept connections..."
for i in $(seq 1 20); do
    if curl -sf http://127.0.0.1:8000/api/v1/health > /dev/null 2>&1; then
        ok "Backend is healthy"
        break
    fi
    if [[ "$i" -eq 20 ]]; then
        fail "Backend did not start within 20 seconds"
        tail -20 "$PROJECT_ROOT/backend/.e2e-backend.log"
        exit 1
    fi
    sleep 1
done

# ── Step 6: Start Frontend Server ─────────────────────────────────────────
header "Starting Frontend Server"

FRONTEND_DIST="$PROJECT_ROOT/frontend/dist"

if [[ ! -d "$FRONTEND_DIST" ]] || [[ "$REBUILD_FRONTEND" == "true" ]]; then
    info "Building frontend..."
    cd "$PROJECT_ROOT/frontend"
    if [[ ! -d node_modules ]]; then
        npm ci --silent 2>/dev/null || npm install --silent
    fi
    npx vite build 2>&1
    ok "Frontend built"
    cd "$PROJECT_ROOT"
fi

# Kill any existing server on port 5173
if lsof -ti:5173 &>/dev/null 2>&1; then
    warn "Port 5173 is in use — stopping existing process..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start a simple HTTP server for the frontend dist
info "Starting frontend static server on http://localhost:5173..."
cd "$FRONTEND_DIST"
nohup "$VENV_DIR/bin/python" -m http.server 5173 \
    > "$PROJECT_ROOT/frontend/.e2e-frontend.log" 2>&1 &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"
echo "  Frontend PID: $FRONTEND_PID"

# Wait for frontend server
for i in $(seq 1 10); do
    if curl -sf http://localhost:5173/ > /dev/null 2>&1; then
        ok "Frontend is serving"
        break
    fi
    if [[ "$i" -eq 10 ]]; then
        fail "Frontend did not start within 10 seconds"
        exit 1
    fi
    sleep 1
done

# ── Step 7: Run E2E Tests ─────────────────────────────────────────────────
header "Running E2E Tests"

cd "$PROJECT_ROOT"

CI_FLAG=""
[[ "$CI_MODE" == "true" ]] && CI_FLAG="--ci"

info "Starting E2E test suite..."
echo ""
if "$VENV_DIR/bin/python" scripts/test_e2e.py $CI_FLAG; then
    E2E_EXIT=0
    echo ""
    ok "All E2E tests passed!"
else
    E2E_EXIT=1
    echo ""
    fail "E2E tests failed — check output above"
fi

# ── Cleanup ───────────────────────────────────────────────────────────────
if [[ "$NO_CLEANUP" == "true" ]]; then
    header "Cleanup Skipped (--no-cleanup)"
    ok "Services left running:"
    echo "  PostgreSQL : port 5432"
    echo "  Backend    : http://localhost:8000 (PID $BACKEND_PID)"
    echo "  Frontend   : http://localhost:5173 (PID $FRONTEND_PID)"
    echo ""
    info "Stop manually with:"
    echo "  kill $BACKEND_PID $FRONTEND_PID"
    echo "  cd $PROJECT_ROOT/backend && docker compose down"
else
    header "Cleanup"

    # Stop backend
    if [[ -n "${BACKEND_PID:-}" ]]; then
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
        ok "Backend stopped"
    fi

    # Stop frontend
    if [[ -n "${FRONTEND_PID:-}" ]]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
        ok "Frontend stopped"
    fi

    # Stop PostgreSQL
    cd "$PROJECT_ROOT/backend"
    docker compose down 2>/dev/null || true
    ok "PostgreSQL stopped"

    cd "$PROJECT_ROOT"
    info "Cleanup complete"
fi

# ── Exit ──────────────────────────────────────────────────────────────────
exit "$E2E_EXIT"
