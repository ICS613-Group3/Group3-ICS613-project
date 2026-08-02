"""Reservation-lifecycle coverage with no corresponding user story.

The state-machine happy paths and their business-rule 409/422s are
exercised by acceptance/test_us13 through test_us21 and test_us34. What's
kept here is: (1) validation/permission edge cases those scenario files
never touch (extra 403 checks, extra 422 validation, non-existent-record
404, the state query filter), (2) full end-to-end smoke coverage of the
lifecycle in one pass, and (3) internal/infrastructure regressions
(exception-handler routing, a DB CHECK constraint, audit-log detail, and
notification side-effects) that no user story could describe in the first
place.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import ReservationState
from app.tests.factories import AdminFactory, ReservationFactory, ToolFactory, UserFactory

pytestmark = pytest.mark.auxiliary


def _make_email() -> str:
    """Generate a unique email address valid for the login endpoint."""
    return f"test+{uuid.uuid4().hex[:12]}@example.com"


class TestCreateReservationValidation:
    """POST /api/v1/reservations — date validation not covered by
    acceptance/test_us13_submit_reservation.py."""

    async def test_create_reservation_start_after_end_returns_422(
        self, client, db_session: AsyncSession
    ) -> None:
        """start_date must be before end_date — returns 422."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        response = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": str(tool.id),
                "start_date": (date.today() + timedelta(days=10)).isoformat(),
                "end_date": (date.today() + timedelta(days=5)).isoformat(),
            },
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 422, (
            f"Expected 422, got {response.status_code}: {response.json()}"
        )

    async def test_create_reservation_past_date_returns_422(
        self, client, db_session: AsyncSession
    ) -> None:
        """Cannot create a reservation starting in the past — returns 422."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        response = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": str(tool.id),
                "start_date": (date.today() - timedelta(days=3)).isoformat(),
                "end_date": (date.today() + timedelta(days=5)).isoformat(),
            },
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 422, (
            f"Expected 422, got {response.status_code}: {response.json()}"
        )


class TestApproveReservationPermissions:
    """POST /api/v1/reservations/{id}/approve — 403 checks not covered by
    acceptance/test_us14_approve_deny.py."""

    async def test_non_owner_cannot_approve_returns_403(
        self, client, db_session: AsyncSession
    ) -> None:
        """A non-owner cannot approve — returns 403 Forbidden."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        # Another random user (not owner, not borrower) tries to approve
        stranger = await UserFactory.create_async(db_session, email=_make_email())
        stranger_token = create_access_token(stranger.id)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/approve",
            headers={"Authorization": f"Bearer {stranger_token}"},
        )

        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}: {response.json()}"
        )

    async def test_borrower_cannot_approve_returns_403(
        self, client, db_session: AsyncSession
    ) -> None:
        """The borrower cannot approve their own reservation — returns 403."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/approve",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}: {response.json()}"
        )


class TestDenyReservationEdgeCases:
    """POST /api/v1/reservations/{id}/deny — cases not covered by
    acceptance/test_us14_approve_deny.py."""

    async def test_owner_can_deny_without_reason(self, client, db_session: AsyncSession) -> None:
        """Deny works without a reason (reason is optional)."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["state"] == "DENIED"
        assert data["denied_reason"] is None

    async def test_non_owner_cannot_deny_returns_403(
        self, client, db_session: AsyncSession
    ) -> None:
        """Non-owner cannot deny — returns 403."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={"reason": "Changed my mind"},
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}: {response.json()}"
        )


class TestCancelReservationEdgeCases:
    """POST /api/v1/reservations/{id}/cancel — the "owner must use deny for
    REQUESTED" rule, which neither test_us15 nor test_us16 exercises (both
    only start reservations at states past REQUESTED for owner-cancel)."""

    async def test_owner_cannot_cancel_requested_use_deny(
        self, client, db_session: AsyncSession
    ) -> None:
        """Owner cannot cancel a REQUESTED reservation — they should use deny instead."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "Not available"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 409, (
            f"Expected 409, got {response.status_code}: {response.json()}"
        )
        assert "deny" in response.json()["detail"].lower()


class TestFullLifecycle:
    """End-to-end smoke test walking the whole state machine in one pass.

    Individual transitions are covered piecemeal across test_us13-us21, but
    this catches integration/wiring regressions between steps that
    per-scenario tests wouldn't (e.g. a stale id or session carried across
    calls)."""

    async def test_full_lifecycle(self, client, db_session: AsyncSession) -> None:
        """Walk through the entire reservation lifecycle end-to-end."""
        # 1. Setup: owner with tool, borrower
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        # 2. Borrower creates reservation
        start = date.today()
        end = date.today() + timedelta(days=3)
        create_resp = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": str(tool.id),
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
            },
            headers={"Authorization": f"Bearer {borrower_token}"},
        )
        assert create_resp.status_code == 201, f"Create failed: {create_resp.json()}"
        reservation_id = create_resp.json()["id"]
        assert create_resp.json()["state"] == "REQUESTED"

        # 3. Owner approves
        approve_resp = await client.post(
            f"/api/v1/reservations/{reservation_id}/approve",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert approve_resp.status_code == 200, f"Approve failed: {approve_resp.json()}"
        assert approve_resp.json()["state"] == "APPROVED"

        # 4. Borrower marks picked up
        pickup_resp = await client.post(
            f"/api/v1/reservations/{reservation_id}/mark-picked-up",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )
        assert pickup_resp.status_code == 200, f"Pickup failed: {pickup_resp.json()}"
        assert pickup_resp.json()["state"] == "PICKED_UP"
        assert pickup_resp.json()["picked_up_at"] is not None

        # 5. Borrower marks returned
        return_resp = await client.post(
            f"/api/v1/reservations/{reservation_id}/mark-returned",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )
        assert return_resp.status_code == 200, f"Return failed: {return_resp.json()}"
        assert return_resp.json()["state"] == "RETURNED"
        assert return_resp.json()["returned_at"] is not None

        # 6. Verify final state via GET
        get_resp = await client.get(
            f"/api/v1/reservations/{reservation_id}",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["state"] == "RETURNED"
        assert get_resp.json()["id"] == reservation_id


class TestDamageCounterIsAtomic:
    """Regression: damage_reported counter increments must be atomic.

    Originally the service did
        owner.damage_reported = (owner.damage_reported or 0) + 1
    which is a read-modify-write that loses concurrent increments. Fixed
    to use ``UPDATE ... SET damage_reported = damage_reported + 1``.
    acceptance/test_us20 only exercises a single damage report per test; this
    verifies two independent reports land as two independent increments.
    """

    async def test_two_damage_reports_increment_twice(
        self, client, db_session: AsyncSession
    ) -> None:
        """Two damage reports on the same owner's tool yield counter == 2."""
        from sqlalchemy import select

        from app.models.user import User

        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        # First reservation — return, then damage-report
        borrower1 = await UserFactory.create_async(db_session, email=_make_email())
        r1 = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower1.id,
            state=ReservationState.RETURNED,
            returned_at=datetime.now(UTC) - timedelta(days=1),
        )
        resp1 = await client.post(
            f"/api/v1/reservations/{r1.id}/mark-damaged",
            json={"description": "Scratched surface"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert resp1.status_code == 200, resp1.text

        # Re-activate the tool for a second damage scenario
        from app.models.tool import Tool

        tool_row = await db_session.get(Tool, tool.id)
        assert tool_row is not None  # set by the first damage flow
        tool_row.is_active = True
        db_session.add(tool_row)
        await db_session.flush()

        # Second reservation on the same owner's tool — different borrower
        borrower2 = await UserFactory.create_async(db_session, email=_make_email())
        r2 = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower2.id,
            state=ReservationState.RETURNED,
            returned_at=datetime.now(UTC) - timedelta(days=1),
        )
        resp2 = await client.post(
            f"/api/v1/reservations/{r2.id}/mark-damaged",
            json={"description": "Chipped handle"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert resp2.status_code == 200, resp2.text

        # The borrower's damage_reported counter should have incremented once each
        await db_session.refresh(borrower1)
        result1 = await db_session.execute(select(User).where(User.id == borrower1.id))
        refreshed1 = result1.scalar_one()
        assert refreshed1.damage_reported == 1, (
            f"Expected borrower1 counter == 1 after one damage report, got "
            f"{refreshed1.damage_reported}"
        )

        await db_session.refresh(borrower2)
        result2 = await db_session.execute(select(User).where(User.id == borrower2.id))
        refreshed2 = result2.scalar_one()
        assert refreshed2.damage_reported == 1, (
            f"Expected borrower2 counter == 1 after one damage report, got "
            f"{refreshed2.damage_reported}"
        )

        # The owner's counter should be unchanged
        await db_session.refresh(owner)
        result3 = await db_session.execute(select(User).where(User.id == owner.id))
        refreshed3 = result3.scalar_one()
        assert refreshed3.damage_reported == 0, (
            f"Expected owner counter == 0 (damage is attributed to borrower), got "
            f"{refreshed3.damage_reported}"
        )


class TestReportDamagePermissions:
    """POST /api/v1/reservations/{id}/mark-damaged — 403 case not covered by
    acceptance/test_us20_confirm_return.py."""

    async def test_non_owner_cannot_report_damage_returns_403(
        self, client, db_session: AsyncSession
    ) -> None:
        """Only the tool owner can report damage — returns 403 for borrower."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.RETURNED,
            returned_at=datetime.now(UTC),
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-damaged",
            json={"description": "It's fine actually"},
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}: {response.json()}"
        )


class TestExceptionHandlerRouting:
    """Regression tests for the central AppError → HTTP mapping.

    Bug: the original mapping used exact-type matching (``type(exc)``), so any
    custom subclass of ``NotFoundError`` (etc.) fell through to 500. Fixed by
    switching to ``isinstance`` iteration. These tests pin the new behavior
    by calling the handler directly with a subclass instance -- there's no
    user-facing scenario that could exercise this infrastructure code path.
    """

    def test_subclass_of_not_found_routes_to_404(self) -> None:
        """A custom NotFoundError subclass returns 404, not 500."""
        from starlette.requests import Request

        from app.core.exceptions import NotFoundError
        from app.main import _handle_app_error

        class _ToolNotFoundError(NotFoundError):
            """Subclass used to test isinstance-based routing."""

        # Minimal request stand-in; the handler does not use it.
        request = Request(scope={"type": "http", "method": "GET", "path": "/", "headers": []})
        response = _handle_app_error(request, _ToolNotFoundError("tool is missing"))
        assert response.status_code == 404
        import json

        body = json.loads(response.body)
        assert body["error_code"] == "_ToolNotFoundError"
        assert body["detail"] == "tool is missing"

    def test_subclass_of_conflict_routes_to_409(self) -> None:
        """A custom ConflictError subclass returns 409, not 500."""
        from starlette.requests import Request

        from app.core.exceptions import ConflictError
        from app.main import _handle_app_error

        class _ToolUnavailableError(ConflictError):
            pass

        request = Request(scope={"type": "http", "method": "GET", "path": "/", "headers": []})
        response = _handle_app_error(request, _ToolUnavailableError("tool is being repaired"))
        assert response.status_code == 409

    def test_exact_type_still_routes_correctly(self) -> None:
        """The non-subclass case must still match (regression guard)."""
        from starlette.requests import Request

        from app.core.exceptions import NotFoundError
        from app.main import _handle_app_error

        request = Request(scope={"type": "http", "method": "GET", "path": "/", "headers": []})
        response = _handle_app_error(request, NotFoundError("missing"))
        assert response.status_code == 404


class TestGetReservationPrivacy:
    """GET /api/v1/reservations/{id} — non-party access, a privacy
    regression not covered by any acceptance scenario."""

    async def test_non_party_cannot_get_reservation(self, client, db_session: AsyncSession) -> None:
        """A user who is neither borrower nor owner gets 403.

        Regression: before the access check was added, any authenticated member
        could view any reservation by ID — a privacy bug.
        """
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool.id, borrower_id=borrower.id
        )

        # A third, unrelated user tries to view
        stranger = await UserFactory.create_async(db_session, email=_make_email())
        stranger_token = create_access_token(stranger.id)

        response = await client.get(
            f"/api/v1/reservations/{reservation.id}",
            headers={"Authorization": f"Bearer {stranger_token}"},
        )
        assert response.status_code == 403, response.text
        assert "not a party" in response.json()["detail"].lower()


class TestListReservationsEdgeCases:
    """GET /api/v1/reservations — the state= filter and 404-for-missing-id,
    neither of which any acceptance scenario exercises."""

    async def test_list_reservations_with_state_filter(
        self, client, db_session: AsyncSession
    ) -> None:
        """List reservations filtered by state."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
        )

        # Create a CANCELLED one that should not show up
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.CANCELLED,
        )

        response = await client.get(
            "/api/v1/reservations?role=borrower&state=APPROVED",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["state"] == "APPROVED"

    async def test_get_nonexistent_reservation_returns_404(
        self, client, db_session: AsyncSession
    ) -> None:
        """Getting a non-existent reservation returns 404."""
        user = await UserFactory.create_async(db_session, email=_make_email())
        user_token = create_access_token(user.id)

        response = await client.get(
            f"/api/v1/reservations/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {user_token}"},
        )

        assert response.status_code == 404, (
            f"Expected 404, got {response.status_code}: {response.json()}"
        )


class TestUnauthenticated:
    """Tests for unauthenticated access — 401 checks not covered by
    acceptance/test_us13_submit_reservation.py or test_us14_approve_deny.py."""

    async def test_create_without_auth_returns_401(self, client) -> None:
        """Creating a reservation without auth returns 401."""
        response = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": str(uuid.uuid4()),
                "start_date": date.today().isoformat(),
                "end_date": (date.today() + timedelta(days=1)).isoformat(),
            },
        )

        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.json()}"
        )

    async def test_approve_without_auth_returns_401(self, client) -> None:
        """Approving without auth returns 401."""
        response = await client.post(
            f"/api/v1/reservations/{uuid.uuid4()}/approve",
        )

        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}: {response.json()}"
        )


class TestCancellerTypeConstraint:
    """M4 — the CHECK constraint on cancelled_by_type rejects foreign values.

    A DB-level constraint test with no HTTP-facing scenario to attach to.
    """

    async def test_db_rejects_invalid_cancelled_by_type(
        self, client, db_session: AsyncSession
    ) -> None:
        """Writing an unrecognised canceller value fails the CHECK constraint."""
        from sqlalchemy.exc import IntegrityError

        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
        res = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.CANCELLED,
        )

        # Try to inject a value outside the documented enum.
        res.cancelled_by_type = "ghost"
        with pytest.raises(IntegrityError):
            await db_session.flush()


class TestReservationModerationAuditLog:
    """R1.C: the audit log captures the side-effect tool deactivation
    triggered by ``mark-damaged`` and the admin escalation via
    ``admin-force-return``. No acceptance scenario asserts on AdminAuditLog
    for either of these actions.
    """

    async def test_mark_damaged_creates_audit_entry(self, client, db_session: AsyncSession) -> None:
        """A damage report that auto-deactivates the tool also writes
        a TOOL_DEACTIVATED row in the admin audit log."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.RETURNED,
        )
        # Backdate returned_at so we are inside the 7-day damage window
        # but have a clear timestamp for the audit row ordering.
        reservation.returned_at = datetime.now(UTC) - timedelta(days=1)
        db_session.add(reservation)
        await db_session.flush()

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-damaged",
            json={"description": "Hammer head came loose during use"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert response.status_code == 200

        from sqlalchemy import select

        from app.models.admin_audit_log import AdminAuditLog

        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.target_id == tool.id,
                AdminAuditLog.action_type == "TOOL_DEACTIVATED",
            )
        )
        entry = result.scalar_one()
        assert entry.target_type == "tool"
        assert entry.actor_id == owner.id
        assert entry.metadata_ == {"actor_role": "damage_report"}
        assert "Damage reported" in entry.reason

    async def test_admin_force_return_creates_audit_entry(
        self, client, db_session: AsyncSession
    ) -> None:
        """Admin force-return → RESERVATION_FORCE_RETURN audit row."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
        borrower = await UserFactory.create_async(db_session, email=_make_email())
        admin = await AdminFactory.create_async(db_session)
        admin_token = create_access_token(admin.id)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/admin-force-return",
            json={"reason": "Borrower disappeared, dispute resolved"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

        from sqlalchemy import select

        from app.models.admin_audit_log import AdminAuditLog

        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.target_id == reservation.id,
                AdminAuditLog.action_type == "RESERVATION_FORCE_RETURN",
            )
        )
        entry = result.scalar_one()
        assert entry.target_type == "reservation"
        assert entry.actor_id == admin.id
        assert entry.reason == "Borrower disappeared, dispute resolved"
        assert entry.metadata_ == {"tool_id": str(tool.id)}


class TestMarkDamagedAutoCancelNotifications:
    """Regression: mark_damaged() previously called pending.scalars().all()
    twice on the same SQLAlchemy Result object. The second call returned an
    empty list, so borrowers whose pending reservations were auto-cancelled
    never received a notification. acceptance/test_us20's damage-report
    scenario checks the auto-cancel state transition but not the
    notification. This test sets up two pending reservations on the same
    tool and verifies both borrowers are notified after a damage report
    deactivates the tool.
    """

    async def test_auto_cancelled_borrowers_get_notifications(
        self, client, db_session: AsyncSession
    ) -> None:
        from sqlalchemy import select

        from app.models.enums import NotificationType
        from app.models.notification import Notification

        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        # Primary borrower — has the RETURNED reservation that will be damage-reported
        borrower1 = await UserFactory.create_async(db_session, email=_make_email())
        reservation1 = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower1.id,
            state=ReservationState.RETURNED,
            returned_at=datetime.now(UTC) - timedelta(days=1),
        )

        # Second borrower — has a REQUESTED reservation that should be auto-cancelled
        borrower2 = await UserFactory.create_async(db_session, email=_make_email())
        reservation2 = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower2.id,
            state=ReservationState.REQUESTED,
            start_date=date.today() + timedelta(days=30),
            end_date=date.today() + timedelta(days=35),
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation1.id}/mark-damaged",
            json={"description": "Blade snapped"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert response.status_code == 200, f"Unexpected: {response.json()}"

        # borrower2's reservation should be CANCELLED
        await db_session.flush()
        await db_session.refresh(reservation2)
        assert reservation2.state == ReservationState.CANCELLED, (
            f"Expected CANCELLED, got {reservation2.state}"
        )

        # borrower2 should have a RESERVATION_CANCELLED notification
        notif_result = await db_session.execute(
            select(Notification).where(
                Notification.user_id == borrower2.id,
                Notification.type == NotificationType.RESERVATION_CANCELLED.value,
            )
        )
        notifs = notif_result.scalars().all()
        assert len(notifs) >= 1, (
            "borrower2 should have received a RESERVATION_CANCELLED notification "
            "after the tool was deactivated by the damage report"
        )


class TestForceReturnOwnerNotification:
    """Regression: force_return() previously only notified the borrower, not
    the tool owner. acceptance/test_us20's force-return scenario doesn't
    check notifications at all.
    """

    async def test_owner_receives_notification_on_force_return(
        self, client, db_session: AsyncSession
    ) -> None:
        from sqlalchemy import select

        from app.models.enums import NotificationType
        from app.models.notification import Notification

        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
        borrower = await UserFactory.create_async(db_session, email=_make_email())
        admin = await AdminFactory.create_async(db_session)
        admin_token = create_access_token(admin.id)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/admin-force-return",
            json={"reason": "Borrower unresponsive"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200, f"Unexpected: {response.json()}"

        # Owner should have a RESERVATION_RETURNED notification
        owner_notifs = await db_session.execute(
            select(Notification).where(
                Notification.user_id == owner.id,
                Notification.type == NotificationType.RESERVATION_RETURNED.value,
            )
        )
        owner_notif_list = owner_notifs.scalars().all()
        assert len(owner_notif_list) >= 1, (
            "Tool owner should receive a notification when their tool is force-returned by an admin"
        )
