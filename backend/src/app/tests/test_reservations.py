"""Tests for reservation lifecycle endpoints."""

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import ReservationState
from app.tests.factories import AdminFactory, ReservationFactory, ToolFactory, UserFactory


# ── Helpers ────────────────────────────────────────────────────────────────
def _make_email() -> str:
    """Generate a unique email address valid for the login endpoint."""
    return f"test+{uuid.uuid4().hex[:12]}@example.com"


# ── Create Reservation ─────────────────────────────────────────────────────

class TestCreateReservation:
    """Tests for POST /api/v1/reservations."""

    async def test_create_reservation_happy_path(
        self, client, db_session: AsyncSession
    ) -> None:
        """A borrower can create a reservation for someone else's tool."""
        # Create owner with tool
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        # Create borrower
        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        start = date.today() + timedelta(days=7)
        end = date.today() + timedelta(days=10)

        response = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": str(tool.id),
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
            },
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 201, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["tool_id"] == str(tool.id)
        assert data["state"] == "REQUESTED"
        assert data["start_date"] == start.isoformat()
        assert data["end_date"] == end.isoformat()

    async def test_create_reservation_for_own_tool_returns_409(
        self, client, db_session: AsyncSession
    ) -> None:
        """Cannot reserve your own tool — returns 409 Conflict."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        start = date.today() + timedelta(days=7)
        end = date.today() + timedelta(days=10)

        response = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": str(tool.id),
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.json()}"
        assert "own tool" in response.json()["detail"].lower()

    async def test_create_overlapping_reservation_returns_409(
        self, client, db_session: AsyncSession
    ) -> None:
        """Test EXCLUDE constraint — overlapping active reservations return 409."""
        # Create owner with tool
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        # Create first borrower with an existing active reservation
        borrower1 = await UserFactory.create_async(db_session, email=_make_email())
        overlapping_start = date.today() + timedelta(days=5)
        overlapping_end = date.today() + timedelta(days=8)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower1.id,
            state=ReservationState.REQUESTED,
            start_date=overlapping_start,
            end_date=overlapping_end,
        )

        # Create second borrower who tries to overlap
        borrower2 = await UserFactory.create_async(db_session, email=_make_email())
        borrower2_token = create_access_token(borrower2.id)

        response = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": str(tool.id),
                "start_date": (date.today() + timedelta(days=6)).isoformat(),
                "end_date": (date.today() + timedelta(days=9)).isoformat(),
            },
            headers={"Authorization": f"Bearer {borrower2_token}"},
        )

        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.json()}"
        assert "already reserved" in response.json()["detail"].lower()

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

        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.json()}"

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

        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.json()}"


# ── Approve Reservation ────────────────────────────────────────────────────

class TestApproveReservation:
    """Tests for POST /api/v1/reservations/{id}/approve."""

    async def test_owner_can_approve(
        self, client, db_session: AsyncSession
    ) -> None:
        """The tool owner can approve a REQUESTED reservation."""
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
            f"/api/v1/reservations/{reservation.id}/approve",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["state"] == "APPROVED"

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

        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.json()}"

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

        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.json()}"


# ── Deny Reservation ───────────────────────────────────────────────────────

class TestDenyReservation:
    """Tests for POST /api/v1/reservations/{id}/deny."""

    async def test_owner_can_deny_with_reason(
        self, client, db_session: AsyncSession
    ) -> None:
        """The tool owner can deny a REQUESTED reservation with a reason."""
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
            json={"reason": "Tool is under maintenance"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["state"] == "DENIED"
        assert data["denied_reason"] == "Tool is under maintenance"

    async def test_owner_can_deny_without_reason(
        self, client, db_session: AsyncSession
    ) -> None:
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

        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.json()}"


# ── Cancel Reservation ─────────────────────────────────────────────────────

class TestCancelReservation:
    """Tests for POST /api/v1/reservations/{id}/cancel."""

    async def test_borrower_can_cancel_requested(
        self, client, db_session: AsyncSession
    ) -> None:
        """The borrower can cancel their own REQUESTED reservation."""
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
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "No longer needed"},
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["state"] == "CANCELLED"
        assert data["cancelled_by_type"] == "borrower"
        assert data["cancelled_reason"] == "No longer needed"

    async def test_owner_can_cancel_approved(
        self, client, db_session: AsyncSession
    ) -> None:
        """The tool owner can cancel an APPROVED reservation."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "Tool is needed for personal use"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["state"] == "CANCELLED"
        assert data["cancelled_by_type"] == "owner"
        assert data["cancelled_reason"] == "Tool is needed for personal use"

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

        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.json()}"
        assert "deny" in response.json()["detail"].lower()

    async def test_stranger_cannot_cancel_returns_403(
        self, client, db_session: AsyncSession
    ) -> None:
        """A stranger (neither owner nor borrower) cannot cancel — returns 403."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        stranger = await UserFactory.create_async(db_session, email=_make_email())
        stranger_token = create_access_token(stranger.id)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "I want to"},
            headers={"Authorization": f"Bearer {stranger_token}"},
        )

        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.json()}"


# ── Mark Picked Up ─────────────────────────────────────────────────────────

class TestMarkPickedUp:
    """Tests for POST /api/v1/reservations/{id}/mark-picked-up."""

    async def test_borrower_can_mark_picked_up(
        self, client, db_session: AsyncSession
    ) -> None:
        """The borrower can mark an APPROVED reservation as PICKED_UP."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=3),
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-picked-up",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["state"] == "PICKED_UP"
        assert data["picked_up_at"] is not None

    async def test_mark_picked_up_before_start_date_returns_422(
        self, client, db_session: AsyncSession
    ) -> None:
        """Cannot pick up before the reservation start date — returns 422."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        # Reservation starts tomorrow — pickup today should fail
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=4),
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-picked-up",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.json()}"
        assert "start date" in response.json()["detail"].lower()

    async def test_non_borrower_cannot_mark_picked_up_returns_403(
        self, client, db_session: AsyncSession
    ) -> None:
        """Only the borrower can mark as picked up — returns 403 for owner."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=3),
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-picked-up",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.json()}"


# ── Mark Returned ──────────────────────────────────────────────────────────

class TestMarkReturned:
    """Tests for POST /api/v1/reservations/{id}/mark-returned."""

    async def test_borrower_can_mark_returned(
        self, client, db_session: AsyncSession
    ) -> None:
        """The borrower can mark a PICKED_UP reservation as RETURNED."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=3),
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-returned",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["state"] == "RETURNED"
        assert data["returned_at"] is not None

    async def test_non_borrower_cannot_mark_returned_returns_403(
        self, client, db_session: AsyncSession
    ) -> None:
        """Only the borrower can mark as returned — returns 403 for owner."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-returned",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.json()}"


# ── Full Lifecycle ─────────────────────────────────────────────────────────

class TestFullLifecycle:
    """Test the complete reservation lifecycle: REQUESTED → APPROVED → PICKED_UP → RETURNED."""

    async def test_full_lifecycle(
        self, client, db_session: AsyncSession
    ) -> None:
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
    """

    async def test_two_damage_reports_increment_twice(
        self, client, db_session: AsyncSession
    ) -> None:
        """Two damage reports on the same owner's tool yield counter == 2."""
        from datetime import timedelta

        from sqlalchemy import select

        from app.models.enums import ReservationState
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

        # The owner's damage_reported counter should have incremented twice
        await db_session.refresh(owner)
        result = await db_session.execute(select(User).where(User.id == owner.id))
        refreshed = result.scalar_one()
        assert refreshed.damage_reported == 2, (
            f"Expected counter == 2 after two damage reports, got "
            f"{refreshed.damage_reported}"
        )


# ── Report Damage ──────────────────────────────────────────────────────────

class TestReportDamage:
    """Tests for POST /api/v1/reservations/{id}/mark-damaged."""

    async def test_owner_can_report_damage_within_window(
        self, client, db_session: AsyncSession
    ) -> None:
        """The tool owner can report damage on a RETURNED reservation within 7 days."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.RETURNED,
            returned_at=datetime.now(UTC) - timedelta(days=1),
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-damaged",
            json={"description": "Scratched surface"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["damage_reported"] is True
        assert data["damage_description"] == "Scratched surface"
        assert data["damage_reported_at"] is not None

        # Flush and refresh to verify tool was deactivated
        await db_session.flush()
        await db_session.refresh(tool)
        assert tool.is_active is False

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

        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.json()}"


# ── List / Get Reservations ────────────────────────────────────────────────

class TestExceptionHandlerRouting:
    """Regression tests for the central AppError → HTTP mapping.

    Bug: the original mapping used exact-type matching (``type(exc)``), so any
    custom subclass of ``NotFoundError`` (etc.) fell through to 500. Fixed by
    switching to ``isinstance`` iteration. These tests pin the new behavior
    by calling the handler directly with a subclass instance.
    """

    def test_subclass_of_not_found_routes_to_404(self) -> None:
        """A custom NotFoundError subclass returns 404, not 500."""
        from starlette.requests import Request

        from app.core.exceptions import NotFoundError
        from app.main import _handle_app_error

        class _ToolNotFoundError(NotFoundError):
            """Subclass used to test isinstance-based routing."""

        # Minimal request stand-in; the handler does not use it.
        request = Request(
            scope={"type": "http", "method": "GET", "path": "/", "headers": []}
        )
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

        request = Request(
            scope={"type": "http", "method": "GET", "path": "/", "headers": []}
        )
        response = _handle_app_error(request, _ToolUnavailableError("tool is being repaired"))
        assert response.status_code == 409

    def test_exact_type_still_routes_correctly(self) -> None:
        """The non-subclass case must still match (regression guard)."""
        from starlette.requests import Request

        from app.core.exceptions import NotFoundError
        from app.main import _handle_app_error

        request = Request(
            scope={"type": "http", "method": "GET", "path": "/", "headers": []}
        )
        response = _handle_app_error(request, NotFoundError("missing"))
        assert response.status_code == 404


class TestGetReservation:
    """Tests for GET /api/v1/reservations/{id}."""

    async def test_borrower_can_get_own_reservation(
        self, client, db_session: AsyncSession
    ) -> None:
        """A borrower can view their own reservation."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool.id, borrower_id=borrower.id
        )

        response = await client.get(
            f"/api/v1/reservations/{reservation.id}",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )
        assert response.status_code == 200
        assert response.json()["id"] == str(reservation.id)

    async def test_owner_can_get_reservation_for_their_tool(
        self, client, db_session: AsyncSession
    ) -> None:
        """The tool owner can view a reservation for their tool."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool.id, borrower_id=borrower.id
        )

        response = await client.get(
            f"/api/v1/reservations/{reservation.id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert response.status_code == 200
        assert response.json()["id"] == str(reservation.id)

    async def test_non_party_cannot_get_reservation(
        self, client, db_session: AsyncSession
    ) -> None:
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


class TestListReservations:
    """Tests for GET /api/v1/reservations."""

    async def test_list_reservations_as_borrower(
        self, client, db_session: AsyncSession
    ) -> None:
        """List reservations filtered by borrower role."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        response = await client.get(
            "/api/v1/reservations?role=borrower",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

    async def test_list_reservations_as_owner(
        self, client, db_session: AsyncSession
    ) -> None:
        """List reservations filtered by owner role."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        response = await client.get(
            "/api/v1/reservations?role=owner",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

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

    async def test_get_single_reservation(
        self, client, db_session: AsyncSession
    ) -> None:
        """Get a reservation by ID."""
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

        response = await client.get(
            f"/api/v1/reservations/{reservation.id}",
            headers={"Authorization": f"Bearer {borrower_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["id"] == str(reservation.id)
        assert data["tool_id"] == str(tool.id)
        assert data["borrower_id"] == str(borrower.id)
        assert data["state"] == "REQUESTED"

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

        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.json()}"


# ── Admin Force Return ─────────────────────────────────────────────────────

class TestAdminForceReturn:
    """Tests for POST /api/v1/reservations/{id}/admin-force-return."""

    async def test_admin_can_force_return(
        self, client, db_session: AsyncSession
    ) -> None:
        """Admin can force-return a PICKED_UP reservation."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
        )

        admin = await AdminFactory.create_async(db_session)
        admin_token = create_access_token(admin.id)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/admin-force-return",
            json={"reason": "Dispute resolution"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert response.status_code == 200, f"Unexpected response: {response.json()}"
        data = response.json()
        assert data["state"] == "RETURNED"
        assert data["force_resolved_by"] == str(admin.id)
        assert data["force_resolution_reason"] == "Dispute resolution"
        assert data["force_resolved_at"] is not None
        assert data["returned_at"] is not None

    async def test_non_admin_cannot_force_return_returns_403(
        self, client, db_session: AsyncSession
    ) -> None:
        """Regular users cannot force-return — returns 403."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        borrower = await UserFactory.create_async(db_session, email=_make_email())

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/admin-force-return",
            json={"reason": "I want it back"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.json()}"


# ── Unauthenticated Access ─────────────────────────────────────────────────

class TestUnauthenticated:
    """Tests for unauthenticated access to reservation endpoints."""

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

        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.json()}"

    async def test_approve_without_auth_returns_401(self, client) -> None:
        """Approving without auth returns 401."""
        response = await client.post(
            f"/api/v1/reservations/{uuid.uuid4()}/approve",
        )

        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.json()}"


class TestCancellerTypeConstraint:
    """M4 — the CHECK constraint on cancelled_by_type rejects foreign values."""

    async def test_db_rejects_invalid_cancelled_by_type(
        self, client, db_session: AsyncSession
    ) -> None:
        """Writing an unrecognised canceller value fails the CHECK constraint."""
        import pytest
        from sqlalchemy.exc import IntegrityError

        from app.models.enums import ReservationState
        from app.tests.factories import ReservationFactory, ToolFactory, UserFactory

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


# ── Audit Log Coverage for Reservation Moderation ─────────────────────────


class TestReservationModerationAuditLog:
    """R1.C: the audit log captures the side-effect tool deactivation
    triggered by ``mark-damaged`` and the admin escalation via
    ``admin-force-return``. Without these rows, the R1.C checklist
    item "Audit-log rows are inserted on every admin/owner
    deactivate and reactivate" would silently fail for these paths.
    """

    async def test_mark_damaged_creates_audit_entry(
        self, client, db_session: AsyncSession
    ) -> None:
        """A damage report that auto-deactivates the tool also writes
        a TOOL_DEACTIVATED row in the admin audit log."""
        owner = await UserFactory.create_async(db_session, email=_make_email())
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
        borrower = await UserFactory.create_async(db_session, email=_make_email())
        borrower_token = create_access_token(borrower.id)

        from datetime import UTC, datetime, timedelta

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


# ── PR #126 Review Fixes ──────────────────────────────────────────────────


class TestMarkDamagedAutoCancelNotifications:
    """Regression: mark_damaged() previously called pending.scalars().all()
    twice on the same SQLAlchemy Result object. The second call returned an
    empty list, so borrowers whose pending reservations were auto-cancelled
    never received a notification. This test sets up two pending reservations
    on the same tool and verifies both borrowers are notified after a damage
    report deactivates the tool.
    """

    async def test_auto_cancelled_borrowers_get_notifications(
        self, client, db_session: AsyncSession
    ) -> None:
        from sqlalchemy import select

        from app.models.notification import Notification
        from app.models.enums import NotificationType

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
                Notification.type == NotificationType.RESERVATION_CANCELLED,
            )
        )
        notifs = notif_result.scalars().all()
        assert len(notifs) >= 1, (
            "borrower2 should have received a RESERVATION_CANCELLED notification "
            "after the tool was deactivated by the damage report"
        )


class TestForceReturnOwnerNotification:
    """Regression: force_return() previously only notified the borrower, not
    the tool owner. The owner is the affected party who likely reported the
    dispute and should be notified when it is resolved.
    """

    async def test_owner_receives_notification_on_force_return(
        self, client, db_session: AsyncSession
    ) -> None:
        from sqlalchemy import select

        from app.models.notification import Notification
        from app.models.enums import NotificationType

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
                Notification.type == NotificationType.RESERVATION_RETURNED,
            )
        )
        owner_notif_list = owner_notifs.scalars().all()
        assert len(owner_notif_list) >= 1, (
            "Tool owner should receive a notification when their tool is "
            "force-returned by an admin"
        )
