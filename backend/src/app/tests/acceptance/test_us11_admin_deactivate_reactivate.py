"""User Story 11 — Deactivate and Reactivate Listings with Admin Controls."""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.models.notification import Notification
from app.tests.acceptance.helpers import auth_header, create_tool, make_admin
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminDeactivatesActiveListing:
    async def test_listing_hidden_marked_deactivated_with_admin_and_timestamp(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        admin = await make_admin(db_session)
        tool = await create_tool(client, owner)

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "reported as unsafe"},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
        assert data["deactivated_by"] == "ADMIN"
        assert data["deactivated_at"] is not None

        other = await UserFactory.create_async(db_session)
        browse = await client.get("/api/v1/tools", headers=auth_header(other.id))
        assert not any(item["id"] == tool["id"] for item in browse.json()["items"])


class TestScenario2AdminCannotDeactivatePickedUpTool:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: same as US10 Scenario 4 -- ToolService.deactivate_tool has "
        "no PICKED_UP guard for any actor, admin included.",
    )
    async def test_deactivate_rejected_while_picked_up(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        admin = await make_admin(db_session)
        tool = await create_tool(client, owner)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
        )

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "trying to deactivate mid-loan"},
            headers=auth_header(admin.id),
        )
        assert response.status_code == 409


class TestScenario3DeactivatingWithPendingReservationsAutoCancels:
    async def test_pending_reservations_auto_cancelled(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        admin = await make_admin(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
        )

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "policy violation"},
            headers=auth_header(admin.id),
        )
        assert response.status_code == 200

        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.CANCELLED

    @pytest.mark.xfail(
        strict=True,
        reason="known gap: ToolService.deactivate_tool (app/services/tool.py) auto-"
        "cancels REQUESTED/APPROVED reservations but never calls NotificationService "
        "-- affected borrowers receive no in-app notification of the cancellation.",
    )
    async def test_affected_borrower_is_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        admin = await make_admin(db_session)
        tool = await create_tool(client, owner)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
        )

        await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "policy violation"},
            headers=auth_header(admin.id),
        )

        notifications = (
            await db_session.execute(
                select(Notification).where(Notification.user_id == borrower.id)
            )
        ).scalars().all()
        assert len(notifications) >= 1


class TestScenario4AdminCanReactivateDeactivatedListing:
    async def test_listing_visible_again_owner_notified_audit_logged(
        self, client, db_session: AsyncSession
    ) -> None:
        from app.models.admin_audit_log import AdminAuditLog

        owner = await UserFactory.create_async(db_session)
        admin = await make_admin(db_session)
        tool = await create_tool(client, owner)
        await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "temporary hold"},
            headers=auth_header(admin.id),
        )

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/reactivate", headers=auth_header(admin.id)
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is True

        other = await UserFactory.create_async(db_session)
        browse = await client.get("/api/v1/tools", headers=auth_header(other.id))
        assert any(item["id"] == tool["id"] for item in browse.json()["items"])

        audit_rows = (
            await db_session.execute(
                select(AdminAuditLog).where(AdminAuditLog.actor_id == admin.id)
            )
        ).scalars().all()
        assert len(audit_rows) >= 1

    @pytest.mark.xfail(
        strict=True,
        reason="known gap: ToolService.reactivate_tool (app/services/tool.py) never "
        "calls NotificationService -- the listing owner receives no notification that "
        "their listing was reactivated.",
    )
    async def test_owner_is_notified_of_reactivation(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        admin = await make_admin(db_session)
        tool = await create_tool(client, owner)
        await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "temporary hold"},
            headers=auth_header(admin.id),
        )
        await client.post(
            f"/api/v1/tools/{tool['id']}/reactivate", headers=auth_header(admin.id)
        )

        notifications = (
            await db_session.execute(
                select(Notification).where(Notification.user_id == owner.id)
            )
        ).scalars().all()
        assert len(notifications) >= 1


class TestScenario5DeactivationLoggedWithAdminIdTimestampReason:
    async def test_audit_log_entry_has_admin_listing_reason(
        self, client, db_session: AsyncSession
    ) -> None:
        from app.models.admin_audit_log import AdminAuditLog

        owner = await UserFactory.create_async(db_session)
        admin = await make_admin(db_session)
        tool = await create_tool(client, owner)

        await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "does not meet safety standards"},
            headers=auth_header(admin.id),
        )

        entry = (
            await db_session.execute(
                select(AdminAuditLog).where(AdminAuditLog.actor_id == admin.id)
            )
        ).scalar_one()
        assert entry.reason == "does not meet safety standards"
        assert entry.target_id == uuid.UUID(tool["id"])
        assert entry.created_at is not None

    @pytest.mark.skip(
        reason="not implemented: GET /api/v1/admin/audit-log (app/api/v1/admin.py) only "
        "exposes action_type/target_type filters -- there is no filter by admin "
        "(actor_id), date range, or specific listing (target_id), so the doc's "
        "'filterable by admin, date range in HST, and by listing' is only partially "
        "true today."
    )
    async def test_audit_log_is_filterable_by_admin_date_and_listing(self) -> None:
        raise NotImplementedError
