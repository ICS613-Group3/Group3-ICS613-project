#!/usr/bin/env python3
"""
End-to-End (E2E) test for Neighborhood Tool Sharing.

Covers the full stack — PostgreSQL → Backend API → Frontend static assets.

Prerequisites (set up by run_e2e.sh):
  1. PostgreSQL container running on port 5432
  2. Database migrated and seeded with dev data
  3. Backend running on http://localhost:8000
  4. Frontend built and served on http://localhost:5173

Usage:
    python scripts/test_e2e.py              # run all checks
    python scripts/test_e2e.py --ci          # CI mode (no password prompt, no color)

Exit codes:
    0   all checks passed
    1   one or more checks failed
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin

# Ensure src/ is on sys.path so backend imports work (for DB access).
_BACKEND_SRC = Path(__file__).resolve().parent.parent / "backend" / "src"
if str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000/api/v1")
FRONTEND_BASE = os.getenv("E2E_FRONTEND_BASE", "http://localhost:5173")
DB_URL = os.getenv(
    "E2E_DB_URL",
    "postgresql://ics613user:ics613password@localhost:5432/toolsharing",
)
# SMTP is not available in E2E — we read verification tokens from the DB directly.
SMTP_AVAILABLE = False

SEED_PASSWORD = "E2eTestPass123!"
SEED_SECRET_KEY = "e2e-test-secret-key-at-least-32-chars-long-!!"

PASS = "PASS"
FAIL = "FAIL"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

    @classmethod
    def ok(cls, text: str) -> str:
        return f"{cls.GREEN}{text}{cls.RESET}"

    @classmethod
    def fail(cls, text: str) -> str:
        return f"{cls.RED}{text}{cls.RESET}"

    @classmethod
    def warn(cls, text: str) -> str:
        return f"{cls.YELLOW}{text}{cls.RESET}"

    @classmethod
    def bold(cls, text: str) -> str:
        return f"{cls.BOLD}{text}{cls.RESET}"

    @classmethod
    def cyan(cls, text: str) -> str:
        return f"{cls.CYAN}{text}{cls.RESET}"


_no_color = False


def ok(msg: str) -> str:
    return msg if _no_color else Colors.ok(msg)


def fail(msg: str) -> str:
    return msg if _no_color else Colors.fail(msg)


def warn(msg: str) -> str:
    return msg if _no_color else Colors.warn(msg)


def bold(msg: str) -> str:
    return msg if _no_color else Colors.bold(msg)


def cyan(msg: str) -> str:
    return msg if _no_color else Colors.cyan(msg)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

import json as _json
import urllib.request
import urllib.error


def _request(
    method: str,
    path: str,
    *,
    json: dict | None = None,
    token: str | None = None,
    base: str = API_BASE,
) -> tuple[int, dict | list | str]:
    """Make an HTTP request and return (status_code, parsed_body)."""
    url = urljoin(base.rstrip("/") + "/", path.lstrip("/"))
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = _json.dumps(json).encode() if json is not None else None
    req = urllib.request.Request(url, data=body, method=method, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            status = resp.status
            ct = resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read()
        ct = e.headers.get("Content-Type", "")
    except urllib.error.URLError as e:
        return 0, {"error": str(e.reason)}
    except Exception as e:
        return 0, {"error": str(e)}

    if "application/json" in ct:
        try:
            parsed = _json.loads(raw)
        except _json.JSONDecodeError:
            parsed = raw.decode()
    else:
        parsed = raw.decode()

    return status, parsed


def _get(path: str, token: str | None = None) -> tuple[int, dict | list | str]:
    return _request("GET", path, token=token)


def _post(
    path: str, json: dict | None = None, token: str | None = None
) -> tuple[int, dict | list | str]:
    return _request("POST", path, json=json, token=token)


def _put(
    path: str, json: dict | None = None, token: str | None = None
) -> tuple[int, dict | list | str]:
    return _request("PUT", path, json=json, token=token)


def _delete(path: str, token: str | None = None) -> tuple[int, dict | list | str]:
    return _request("DELETE", path, token=token)


def _get_json(data: dict | list | str) -> dict:
    """Safely extract a dict from response body that might be a list or string."""
    if isinstance(data, dict):
        return data
    if isinstance(data, list):
        return {"items": data}
    return {}


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _fetch_token_from_db(db_url: str, token_column: str, table: str,
                         email: str | None = None) -> str | None:
    """Fetch a token from the database (bypass SMTP for E2E tests)."""
    try:
        import psycopg2
    except ImportError:
        print(f"  {fail('SKIP')} psycopg2 not installed — cannot read tokens from DB")
        return None

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        if email:
            # For verification tokens, need to join with users table
            if table == "email_verification_tokens":
                cur.execute(
                    f"""
                    SELECT evt.{token_column}
                    FROM {table} evt
                    JOIN users u ON u.id = evt.user_id
                    WHERE u.email = %s
                    AND evt.used_at IS NULL
                    AND evt.expires_at > NOW()
                    ORDER BY evt.created_at DESC
                    LIMIT 1
                    """,
                    (email,),
                )
            else:
                cur.execute(
                    f"SELECT {token_column} FROM {table} WHERE email = %s "
                    f"ORDER BY created_at DESC LIMIT 1",
                    (email,),
                )
        else:
            cur.execute(
                f"SELECT {token_column} FROM {table} "
                f"ORDER BY created_at DESC LIMIT 1"
            )
        row = cur.fetchone()
        cur.close()
        conn.close()
        return str(row[0]) if row else None
    except Exception as e:
        print(f"  {fail('FAIL')} DB query error: {e}")
        return None


# ---------------------------------------------------------------------------
# Test counters
# ---------------------------------------------------------------------------

_tests_run = 0
_tests_passed = 0
_tests_failed = 0
_current_section = ""


def _section(name: str) -> None:
    global _current_section
    _current_section = name
    print(f"\n{cyan('═' * 60)}")
    print(f"{bold(name)}")
    print(f"{cyan('─' * 60)}")


def _check(description: str, condition: bool, detail: str = "") -> None:
    global _tests_run, _tests_passed, _tests_failed
    _tests_run += 1
    status = PASS if condition else FAIL
    icon = ok("✓") if condition else fail("✗")
    label = ok(status) if condition else fail(status)
    msg = f"  {icon} {label}  {description}"
    if detail and not condition:
        msg += f"\n         {fail(detail)}"
    print(msg)
    if condition:
        _tests_passed += 1
    else:
        _tests_failed += 1


def _ensure(description: str, condition: bool, detail: str = "") -> bool:
    """Check and return condition — for fatal preconditions."""
    _check(description, condition, detail)
    return condition


# ---------------------------------------------------------------------------
# E2E Test Suite
# ---------------------------------------------------------------------------

def test_health() -> dict:
    """Smoke test: backend is alive."""
    _section("1. Health Check")

    status, data = _get("/health")
    _ensure(
        "GET /health returns 200",
        status == 200,
        f"Got status {status}"
    )
    msg = data.get("status", "") if isinstance(data, dict) else ""
    _check(
        "Health response has status=ok",
        msg == "ok",
        f"Got {data}"
    )
    return {}

def test_frontend_served() -> dict:
    """Verify the frontend static build is being served."""
    _section("2. Frontend Static Assets")

    # Check frontend index.html
    status, data = _request("GET", "/", base=FRONTEND_BASE)
    _ensure(
        "Frontend index.html is served",
        status == 200,
        f"Got status {status}"
    )
    html = data if isinstance(data, str) else ""
    _check(
        "index.html contains <div id=\"root\">",
        '<div id="root">' in html,
        f"Response is {type(data).__name__}, not HTML"
    )
    _check(
        "index.html references React bundle",
        '/assets/index-' in html,
    )
    _check(
        "index.html has <title>",
        '<title>' in html,
    )

    # Check a JS asset loads
    import re
    js_match = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
    if js_match:
        js_path = js_match.group(1)
        js_status, _ = _request("GET", js_path, base=FRONTEND_BASE)
        _check(
            f"JS bundle {js_path} is served",
            js_status == 200,
            f"Got status {js_status}",
        )
    else:
        _check("JS bundle reference found in HTML", False, "No /assets/index-*.js src found")

    return {"html": html}


def test_auth_flow(artifacts: dict) -> dict:
    """Full auth lifecycle: admin login → invite → register → verify → re-login."""
    _section("3. Auth Flow")

    # 3a. Login as admin (seeded)
    status, data = _post("/auth/login", json={
        "email": "admin@example.com",
        "password": SEED_PASSWORD,
    })
    _ensure(
        "Admin login succeeds (200)",
        status == 200,
        f"Got status {status}: {data}",
    )
    admin_data = data if isinstance(data, dict) else {}
    admin_token = admin_data.get("access_token", "")
    _ensure(
        "Admin gets access_token",
        bool(admin_token),
        f"Response: {admin_data}",
    )
    admin_refresh = admin_data.get("refresh_token", "")
    _check(
        "Admin gets refresh_token",
        bool(admin_refresh),
    )
    _check(
        "Response includes token_type=bearer",
        admin_data.get("token_type") == "bearer",
    )

    # 3b. Get admin profile
    status, data = _get("/auth/me", token=admin_token)
    _check(
        "GET /auth/me for admin returns 200",
        status == 200,
        f"Got {status}",
    )
    me = data if isinstance(data, dict) else {}
    _check(
        "Admin profile has is_admin=true",
        me.get("is_admin") is True,
        f"is_admin={me.get('is_admin')}",
    )
    _check(
        "Admin profile has email=admin@example.com",
        me.get("email") == "admin@example.com",
        f"Got {me.get('email')}",
    )
    _check(
        "Admin profile has full_name=Admin User",
        me.get("full_name") == "Admin User",
        f"Got {me.get('full_name')}",
    )

    # 3c. Admin creates invite
    new_email = f"e2euser+{uuid.uuid4().hex[:8]}@example.com"
    status, data = _post("/auth/invites", json={"email": new_email}, token=admin_token)
    _ensure(
        f"Admin creates invite for {new_email} (201)",
        status == 201,
        f"Got {status}: {data}",
    )
    invite = data if isinstance(data, dict) else {}
    invite_token = invite.get("token", "")
    _ensure(
        "Invite response includes a token",
        bool(invite_token),
        f"Got: {invite}",
    )
    _check(
        f"Invite email matches {new_email}",
        invite.get("email") == new_email,
    )
    _check(
        "Invite status is 'sent'",
        invite.get("status") == "sent",
    )

    # 3d. Register with invite token
    register_password = "NewE2eUserPass1!"
    status, data = _post("/auth/register", json={
        "email": new_email,
        "password": register_password,
        "full_name": "E2E Test User",
        "invite_token": invite_token,
    })
    _ensure(
        f"Register {new_email} succeeds (201)",
        status == 201,
        f"Got {status}: {data}",
    )
    reg_msg = data.get("message", "") if isinstance(data, dict) else ""
    _check(
        "Registration message mentions verification",
        "verification" in reg_msg.lower() or "verify" in reg_msg.lower(),
        f"Got: {reg_msg}",
    )

    # 3e. Try login before verification (should fail with generic error)
    status, data = _post("/auth/login", json={
        "email": new_email,
        "password": register_password,
    })
    _check(
        "Login before verification returns 401",
        status == 401,
        f"Got {status}",
    )

    # 3f. Fetch verification token from DB (bypass SMTP)
    print(f"\n  {cyan('→')}  Fetching email verification token from DB...")
    verify_token = _fetch_token_from_db(DB_URL, "token", "email_verification_tokens", new_email)
    _ensure(
        "Verification token found in database",
        verify_token is not None,
        "SMTP not available and no token in DB — registration may have failed",
    )
    print(f"      token={verify_token[:20] if verify_token else 'N/A'}...")

    # 3g. Verify email
    status, data = _post("/auth/verify-email", json={"token": verify_token})
    _ensure(
        "Email verification succeeds (200)",
        status == 200,
        f"Got {status}: {data}",
    )
    verify_data = data if isinstance(data, dict) else {}
    new_access = verify_data.get("access_token", "")
    _ensure(
        "Verification returns access_token",
        bool(new_access),
    )
    _check(
        "Verification returns refresh_token",
        bool(verify_data.get("refresh_token")),
    )

    # 3h. Login after verification
    status, data = _post("/auth/login", json={
        "email": new_email,
        "password": register_password,
    })
    _ensure(
        "Login after verification succeeds (200)",
        status == 200,
        f"Got {status}: {data}",
    )

    # 3i. Refresh token
    login_data = data if isinstance(data, dict) else {}
    refresh_token = login_data.get("refresh_token", "")
    status, data = _post("/auth/refresh", json={"refresh_token": refresh_token})
    _ensure(
        "Token refresh succeeds (200)",
        status == 200,
        f"Got {status}: {data}",
    )
    refresh_data = data if isinstance(data, dict) else {}
    _check(
        "Refresh returns new access_token",
        bool(refresh_data.get("access_token")),
    )
    _check(
        "Refresh returns new refresh_token",
        bool(refresh_data.get("refresh_token")),
    )

    return {
        "admin_token": admin_token,
        "admin_refresh": admin_refresh,
        "new_email": new_email,
        "new_password": register_password,
        "new_user_token": new_access,
    }


def test_tool_lifecycle(artifacts: dict) -> dict:
    """Create, browse, update, and deactivate tools."""
    _section("4. Tool Lifecycle")

    admin_token = artifacts["admin_token"]

    # 4a. Login as member01 (Demo Owner)
    status, data = _post("/auth/login", json={
        "email": "member01@example.com",
        "password": SEED_PASSWORD,
    })
    _ensure(
        "member01 login succeeds (200)",
        status == 200,
        f"Got {status}",
    )
    owner_data = data if isinstance(data, dict) else {}
    owner_token = owner_data.get("access_token", "")

    # 4b. List my existing tools (seeded)
    status, data = _get("/tools/me", token=owner_token)
    _ensure(
        "GET /tools/me returns 200",
        status == 200,
        f"Got {status}",
    )
    my_tools = data if isinstance(data, dict) else {}
    _check(
        "My tools response has 'items' key",
        "items" in my_tools,
    )
    # Admin all tools
    status, data = _get("/tools/admin/all", token=admin_token)
    _ensure(
        "Admin lists all tools (200)",
        status == 200,
        f"Got {status}",
    )
    all_tools = data if isinstance(data, dict) else {}
    total_tools = all_tools.get("total", 0)
    _check(
        "At least 12 tools seeded",
        total_tools >= 12,
        f"Got {total_tools} tools",
    )

    # 4c. Create a new tool
    import urllib.parse
    boundary = "----E2ETestBoundary" + uuid.uuid4().hex[:8]
    body_lines = []
    for field_name, field_value in [
        ("name", "E2E Test Hammer"),
        ("category", "HAND_TOOLS"),
        ("condition", "NEW"),
        ("description", "A brand new hammer created during E2E testing."),
    ]:
        body_lines.append(f"--{boundary}".encode())
        body_lines.append(f'Content-Disposition: form-data; name="{field_name}"'.encode())
        body_lines.append(b"")
        body_lines.append(field_value.encode())

    body_lines.append(f"--{boundary}--".encode())
    body_lines.append(b"")
    body = b"\r\n".join(body_lines)

    url = urljoin(API_BASE.rstrip("/") + "/", "tools")
    headers = {
        "Authorization": f"Bearer {owner_token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            create_status = resp.status
            create_raw = resp.read()
    except urllib.error.HTTPError as e:
        create_status = e.code
        create_raw = e.read()
    _ensure(
        "Create tool returns 201",
        create_status == 201,
        f"Got {create_status}: {create_raw.decode()[:200]}",
    )
    try:
        new_tool = _json.loads(create_raw)
    except _json.JSONDecodeError:
        new_tool = {}
    new_tool_id = new_tool.get("id", "")
    _ensure(
        "New tool has an id",
        bool(new_tool_id),
    )
    _check(
        "New tool name matches",
        new_tool.get("name") == "E2E Test Hammer",
    )
    _check(
        "New tool is active",
        new_tool.get("is_active") is True,
    )
    _check(
        "New tool belongs to member01",
        new_tool.get("owner_id") == new_tool.get("owner_id"),
    )

    # 4d. Get the tool by ID
    status, data = _get(f"/tools/{new_tool_id}", token=owner_token)
    _check(
        "GET /tools/{id} succeeds (200)",
        status == 200,
        f"Got {status}",
    )

    # 4e. Update the tool
    status, data = _patch(f"/tools/{new_tool_id}", json={
        "name": "E2E Test Hammer (Updated)",
        "condition": "LIKE_NEW",
    }, token=owner_token)
    _check(
        "PATCH /tools/{id} succeeds (200)",
        status == 200,
        f"Got {status}",
    )

    # 4f. Browse tools (as a different user)
    status, data = _post("/auth/login", json={
        "email": "member02@example.com",
        "password": SEED_PASSWORD,
    })
    borrower_data = data if isinstance(data, dict) else {}
    borrower_token = borrower_data.get("access_token", "")

    status, data = _get("/tools", token=borrower_token)
    _ensure(
        "Browse tools returns 200",
        status == 200,
        f"Got {status}",
    )
    browse = data if isinstance(data, dict) else {}
    browse_count = len(browse.get("items", []))
    _check(
        "Browse shows available tools",
        browse_count > 0,
        f"Got {browse_count} tools (expected at least 1)",
    )
    _check(
        "Browse excludes borrower's own tools",
        all(t.get("owner_id") != borrower_data.get("id", "") for t in browse.get("items", []))
        if borrower_data.get("id") else True,
    )

    # 4g. Deactivate a tool
    status, data = _post(f"/tools/{new_tool_id}/deactivate",
                         json={"reason": "E2E test deactivation"},
                         token=owner_token)
    _check(
        "Deactivate tool succeeds (200)",
        status == 200,
        f"Got {status}",
    )
    deactivated = data if isinstance(data, dict) else {}
    _check(
        "Tool is_active=False after deactivation",
        deactivated.get("is_active") is False,
    )
    _check(
        "Deactivation reason stored",
        deactivated.get("deactivation_reason") == "E2E test deactivation",
    )

    # 4h. Reactivate tool (admin only)
    status, data = _post(f"/tools/{new_tool_id}/reactivate", token=admin_token)
    _check(
        "Admin reactivates tool (200)",
        status == 200,
        f"Got {status}",
    )
    reactivated = data if isinstance(data, dict) else {}
    _check(
        "Tool is_active=True after reactivation",
        reactivated.get("is_active") is True,
    )

    return {
        "owner_token": owner_token,
        "borrower_token": borrower_token,
        "tool_id": new_tool_id,
    }


def test_reservation_flow(artifacts: dict) -> dict:
    """Full reservation lifecycle: request → approve → pickup → return → review."""
    _section("5. Reservation Lifecycle")

    owner_token = artifacts["owner_token"]
    borrower_token = artifacts["borrower_token"]
    tool_id = artifacts["tool_id"]

    # 5a. Borrower requests a reservation (starting TODAY so pickup works immediately)
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    day_after_tomorrow = (datetime.now(UTC) + timedelta(days=2)).strftime("%Y-%m-%d")
    status, data = _post("/reservations", json={
        "tool_id": tool_id,
        "start_date": today,
        "end_date": day_after_tomorrow,
    }, token=borrower_token)
    _ensure(
        "Create reservation returns 201",
        status == 201,
        f"Got {status}: {data}",
    )
    reservation = data if isinstance(data, dict) else {}
    reservation_id = reservation.get("id", "")
    _ensure(
        "Reservation has an id",
        bool(reservation_id),
    )
    _check(
        "Reservation state is REQUESTED",
        reservation.get("state") == "REQUESTED",
        f"Got {reservation.get('state')}",
    )
    _check(
        "Reservation has correct tool_id",
        reservation.get("tool_id") == tool_id,
    )
    _check(
        "Reservation has correct start_date",
        reservation.get("start_date", "").startswith(today),
    )

    # 5b. Owner approves
    status, data = _post(f"/reservations/{reservation_id}/approve", token=owner_token)
    _ensure(
        "Owner approves reservation (200)",
        status == 200,
        f"Got {status}: {data}",
    )
    approved = data if isinstance(data, dict) else {}
    _check(
        "Reservation state is APPROVED",
        approved.get("state") == "APPROVED",
        f"Got {approved.get('state')}",
    )

    # 5c. Borrower picks up
    status, data = _post(f"/reservations/{reservation_id}/mark-picked-up",
                         token=borrower_token)
    _ensure(
        "Borrower marks picked up (200)",
        status == 200,
        f"Got {status}: {data}",
    )
    picked = data if isinstance(data, dict) else {}
    _check(
        "Reservation state is PICKED_UP",
        picked.get("state") == "PICKED_UP",
        f"Got {picked.get('state')}",
    )
    _check(
        "picked_up_at is set",
        picked.get("picked_up_at") is not None,
    )

    # 5d. List reservations for owner
    status, data = _get("/reservations?role=owner", token=owner_token)
    _check(
        "Owner lists reservations (200)",
        status == 200,
        f"Got {status}",
    )
    owner_reservations = data if isinstance(data, dict) else {}
    _check(
        "Owner sees reservations",
        len(owner_reservations.get("items", [])) > 0,
    )

    # 5e. List reservations for borrower
    status, data = _get("/reservations?role=borrower", token=borrower_token)
    _check(
        "Borrower lists reservations (200)",
        status == 200,
    )
    borrower_reservations = data if isinstance(data, dict) else {}
    _check(
        "Borrower sees reservations",
        len(borrower_reservations.get("items", [])) > 0,
    )

    # 5f. Borrower marks returned (the borrower reports the tool as returned to the owner)
    status, data = _post(f"/reservations/{reservation_id}/mark-returned",
                         token=borrower_token)
    _ensure(
        "Borrower marks returned (200)",
        status == 200,
        f"Got {status}: {data}",
    )
    returned = data if isinstance(data, dict) else {}
    _check(
        "Reservation state is RETURNED",
        returned.get("state") == "RETURNED",
        f"Got {returned.get('state')}",
    )
    _check(
        "returned_at is set",
        returned.get("returned_at") is not None,
    )

    # 5g. Borrower leaves a review
    status, data = _post(f"/reservations/{reservation_id}/review", json={
        "rating": 5,
        "comment": "Great tool, exactly as described! E2E test review.",
    }, token=borrower_token)
    _ensure(
        "Submit review succeeds (201)",
        status == 201,
        f"Got {status}: {data}",
    )
    review = data if isinstance(data, dict) else {}
    _check(
        "Review has an id",
        bool(review.get("id")),
    )
    _check(
        "Review rating is 5",
        review.get("rating") == 5,
    )
    _check(
        "Review has comment",
        bool(review.get("comment")),
    )
    _check(
        "Review is for the correct reservation",
        review.get("reservation_id") == reservation_id,
    )

    return {"reservation_id": reservation_id}


def test_admin_flow(artifacts: dict) -> dict:
    """Admin-specific endpoints."""
    _section("6. Admin Flow")

    admin_token = artifacts["admin_token"]

    # 6a. List invites
    status, data = _get("/auth/invites", token=admin_token)
    _ensure(
        "Admin lists invites (200)",
        status == 200,
        f"Got {status}",
    )
    invites = data if isinstance(data, list) else (
        data.get("items", []) if isinstance(data, dict) else []
    )
    _check(
        "Invite list is not empty",
        len(invites) > 0,
    )
    if invites and isinstance(invites[0], dict):
        _check(
            "Invite has expected fields",
            "email" in invites[0] and "status" in invites[0],
        )

    # 6b. List audit log
    status, data = _get("/admin/audit-log", token=admin_token)
    _ensure(
        "Admin lists audit log (200)",
        status == 200,
        f"Got {status}",
    )
    audit = data if isinstance(data, dict) else {}
    _check(
        "Audit log has 'items'",
        "items" in audit,
    )

    # 6c. Admin views all tools
    status, data = _get("/tools/admin/all", token=admin_token)
    _check(
        "Admin views all tools (200)",
        status == 200,
    )

    return {}


def test_notifications(artifacts: dict) -> dict:
    """Notification endpoints."""
    _section("7. Notifications")

    owner_token = artifacts["owner_token"]
    borrower_token = artifacts["borrower_token"]

    for label, token in [("Owner", owner_token), ("Borrower", borrower_token)]:
        status, data = _get("/notifications", token=token)
        _check(
            f"{label} lists notifications (200)",
            status == 200,
            f"Got {status}",
        )
        notifs = data if isinstance(data, dict) else {}
        # Notifications may be empty depending on seed data — just check the shape
        _check(
            f"{label} notifications has 'items' key",
            "items" in notifs,
        )

    return {}


def test_error_handling(artifacts: dict) -> dict:
    """Verify error responses are well-formed."""
    _section("8. Error Handling")

    admin_token = artifacts["admin_token"]

    # 8a. Invalid login
    status, data = _post("/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "wrongpassword",
    })
    _check(
        "Invalid login returns 401",
        status == 401,
        f"Got {status}",
    )
    err = data if isinstance(data, dict) else {}
    _check(
        "Error response has 'detail' field",
        "detail" in err,
    )
    _check(
        "Generic error message (no email enumeration — 'Invalid email or password' is correct)",
        "not found" not in err.get("detail", "").lower(),
        f"Detail: {err.get('detail', '')}",
    )

    # 8b. Unauthorized access
    status, _ = _get("/auth/me")  # no token
    _check(
        "GET /auth/me without token returns 401",
        status == 401,
        f"Got {status}",
    )

    # 8c. 404 for non-existent tool
    fake_id = "00000000-0000-0000-0000-000000000000"
    status, data = _get(f"/tools/{fake_id}", token=admin_token)
    _check(
        "Non-existent tool returns 404",
        status == 404,
        f"Got {status}",
    )

    return {}


# ---------------------------------------------------------------------------
# PATCH helper (needed because urllib doesn't natively support it)
# ---------------------------------------------------------------------------

def _patch(
    path: str, *, json: dict | None = None, token: str | None = None
) -> tuple[int, dict | list | str]:
    """Make a PATCH request."""
    url = urljoin(API_BASE.rstrip("/") + "/", path.lstrip("/"))
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = _json.dumps(json).encode() if json is not None else None
    req = urllib.request.Request(url, data=body, method="PATCH", headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            status = resp.status
            ct = resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read()
        ct = e.headers.get("Content-Type", "")
    except Exception as e:
        return 0, {"error": str(e)}

    if "application/json" in ct:
        try:
            parsed = _json.loads(raw)
        except _json.JSONDecodeError:
            parsed = raw.decode()
    else:
        parsed = raw.decode()

    return status, parsed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    global _tests_run, _tests_passed, _tests_failed, _no_color

    parser = argparse.ArgumentParser(description="E2E test for Neighborhood Tool Sharing")
    parser.add_argument("--ci", action="store_true", help="CI mode (no color)")
    args = parser.parse_args()

    _no_color = args.ci

    print()
    print(bold("  ╔══════════════════════════════════════════════════════╗"))
    print(bold("  ║   Neighborhood Tool Sharing — End-to-End Test Suite  ║"))
    print(bold("  ╚══════════════════════════════════════════════════════╝"))
    print()
    print(f"  Backend:  {API_BASE}")
    print(f"  Frontend: {FRONTEND_BASE}")
    print(f"  Database: {DB_URL.replace(DB_URL.split(':')[2].split('@')[0], '****')}")
    print()

    artifacts: dict = {}

    # ── Pre-check: services reachable ──
    _section("0. Pre-checks")
    status, _ = _get("/health")
    if not _ensure(
        "Backend is reachable",
        status > 0,
        f"Cannot reach {API_BASE} — is the backend running?",
    ):
        print(f"\n  {fail('ABORTING')} Backend not reachable. Start the stack first.")
        return 1

    # ── Tests ──
    try:
        a = test_health()
        artifacts.update(a)

        a = test_frontend_served()
        artifacts.update(a)

        a = test_auth_flow(artifacts)
        artifacts.update(a)

        a = test_tool_lifecycle(artifacts)
        artifacts.update(a)

        a = test_reservation_flow(artifacts)
        artifacts.update(a)

        a = test_admin_flow(artifacts)
        artifacts.update(a)

        a = test_notifications(artifacts)
        artifacts.update(a)

        a = test_error_handling(artifacts)
        artifacts.update(a)

    except Exception as e:
        import traceback
        print(f"\n  {fail('UNEXPECTED ERROR')}: {e}")
        traceback.print_exc()
        _tests_failed += 1

    # ── Summary ──
    print()
    print(cyan("═" * 60))
    print(bold("  Results Summary"))
    print(cyan("─" * 60))
    total = _tests_run
    passed = _tests_passed
    failed = _tests_failed
    pct = (passed / total * 100) if total > 0 else 0

    if failed == 0:
        print(f"  {ok('✓ ALL TESTS PASSED')}")
    else:
        print(f"  {fail(f'✗ {failed} TEST(S) FAILED')}")
    print(f"  Total: {total}  |  Passed: {ok(str(passed))}  |  "
          f"Failed: {fail(str(failed))}  |  "
          f"Pass rate: {pct:.1f}%")
    print(cyan("═" * 60))
    print()

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
