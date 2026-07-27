"""Tool endpoint coverage with no corresponding user story.

Create/update/delete happy paths and their permission checks are already
exercised by acceptance/test_us08_create_listing.py,
test_us09_edit_listing_photos.py, and test_us10_delete_deactivate_listing.py.
What's kept here has no story mapping: /tools/me, GET-single edge cases,
deactivate/reactivate conflict + audit-log detail, field-validation edge
cases, photo-upload magic-byte security, and the admin-only /tools/admin/all
listing.
"""

import uuid
from io import BytesIO

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.admin_audit_log import AdminAuditLog
from app.tests.factories import AdminFactory, ToolFactory, UserFactory

pytestmark = pytest.mark.auxiliary


def _bearer(user) -> dict:
    """Return an Authorization header dict for *user*."""
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _fake_image_bytes() -> bytes:
    """Minimal 1×1 white JPEG (valid image content for validation)."""
    return (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\x09\x09"
        b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e"
        b"\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
        b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00"
        b"\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00"
        b"\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00"
        b"\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00"
        b'\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07"q\x142'
        b"\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18"
        b"\x19\x1a%&'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz"
        b"\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99"
        b"\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7"
        b"\xb8\xb9\xba\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5"
        b"\xd6\xd7\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1"
        b"\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01\x00"
        b"\x00?\x00\xd2\xcf \xff\xd9"
    )


def _fake_upload_file(filename: str = "test.jpg") -> tuple:
    """Return (filename, bytes, content_type) suitable for httpx files=."""
    return (filename, BytesIO(_fake_image_bytes()), "image/jpeg")


class TestListTools:
    """GET /api/v1/tools — behavior not exercised by acceptance/test_us12_browse_search.py."""

    async def test_list_tools_paginated(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Listing returns paginated active tools, excluding the browsing user's own."""
        owner = await UserFactory.create_async(db_session)
        browser = await UserFactory.create_async(db_session)
        for i in range(5):
            await ToolFactory.create_async(
                db_session,
                owner_id=owner.id,
                name=f"Public Tool {i}",
                category="HAND_TOOLS",
                is_active=True,
            )

        response = await client.get(
            "/api/v1/tools?page=1&page_size=3",
            headers=_bearer(browser),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 3
        assert data["pages"] == 2
        assert len(data["items"]) == 3
        # Items should be ToolResponse shape
        first = data["items"][0]
        assert "id" in first
        assert "owner_id" in first
        assert "owner" in first
        assert first["owner"]["id"] == str(owner.id)
        assert first["owner"]["full_name"] == owner.full_name
        assert "name" in first
        assert "photos" in first

    async def test_list_tools_excludes_inactive(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """List tools only returns active listings (browsing user's own are excluded regardless)."""
        owner = await UserFactory.create_async(db_session)
        browser = await UserFactory.create_async(db_session)
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Active Tool",
            is_active=True,
        )
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Inactive Tool",
            is_active=False,
        )

        response = await client.get(
            "/api/v1/tools",
            headers=_bearer(browser),
        )

        assert response.status_code == 200
        data = response.json()
        names = [t["name"] for t in data["items"]]
        assert "Active Tool" in names
        assert "Inactive Tool" not in names

    async def test_list_tools_excludes_browsing_users_own_tools(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Browse endpoint excludes tools owned by the browsing user."""
        owner = await UserFactory.create_async(db_session)
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Owner's Drill",
            is_active=True,
        )
        # Another user's tool should appear
        other = await UserFactory.create_async(db_session)
        await ToolFactory.create_async(
            db_session,
            owner_id=other.id,
            name="Other's Hammer",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/tools",
            headers=_bearer(owner),
        )

        assert response.status_code == 200
        data = response.json()
        names = [t["name"] for t in data["items"]]
        # Owner's own tool is excluded; other user's tool appears
        assert "Owner's Drill" not in names
        assert "Other's Hammer" in names
        assert data["total"] == 1

    async def test_list_tools_requires_auth(
        self,
        client,
    ) -> None:
        """Listing tools requires authentication."""
        response = await client.get("/api/v1/tools")
        assert response.status_code == 401


class TestMyTools:
    """GET /api/v1/tools/me — never exercised as its own scenario anywhere in acceptance/."""

    async def test_list_my_tools(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Returns only the requesting user's tools (including inactive)."""
        owner = await UserFactory.create_async(db_session)
        other = await UserFactory.create_async(db_session)

        await ToolFactory.create_async(
            db_session, owner_id=owner.id, name="My Drill", is_active=True
        )
        await ToolFactory.create_async(
            db_session, owner_id=owner.id, name="My Old Saw", is_active=False
        )
        await ToolFactory.create_async(
            db_session, owner_id=other.id, name="Their Hammer", is_active=True
        )

        response = await client.get(
            "/api/v1/tools/me",
            headers=_bearer(owner),
        )

        assert response.status_code == 200
        data = response.json()
        names = {t["name"] for t in data["items"]}
        assert names == {"My Drill", "My Old Saw"}
        assert data["total"] == 2

    async def test_list_my_tools_paginated(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """My tools support pagination."""
        owner = await UserFactory.create_async(db_session)
        for i in range(4):
            await ToolFactory.create_async(
                db_session, owner_id=owner.id, name=f"Mine {i}", is_active=True
            )

        response = await client.get(
            "/api/v1/tools/me?page=1&page_size=2",
            headers=_bearer(owner),
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 4
        assert data["pages"] == 2


class TestGetTool:
    """GET /api/v1/tools/{tool_id} — 404 cases not covered elsewhere."""

    async def test_get_nonexistent_tool_returns_404(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Requesting a non-existent tool returns 404."""
        user = await UserFactory.create_async(db_session)
        fake_id = uuid.uuid4()

        response = await client.get(
            f"/api/v1/tools/{fake_id}",
            headers=_bearer(user),
        )

        assert response.status_code == 404

    async def test_get_inactive_tool_by_non_owner_returns_404(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """A non-owner requesting an inactive tool gets 404."""
        owner = await UserFactory.create_async(db_session)
        other = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Hidden Tool",
            is_active=False,
        )

        response = await client.get(
            f"/api/v1/tools/{tool.id}",
            headers=_bearer(other),
        )

        # get_tool with active_only=True (default) returns 404 for inactive
        assert response.status_code == 404


class TestDeactivateTool:
    """POST /api/v1/tools/{tool_id}/deactivate — conflict case not covered by
    acceptance/test_us10_delete_deactivate_listing.py or test_us11."""

    async def test_deactivate_already_inactive_returns_409(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Deactivating an already-inactive tool returns 409 Conflict."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
            name="Already Off",
            is_active=False,
        )

        response = await client.post(
            f"/api/v1/tools/{tool.id}/deactivate",
            json={"reason": "Double deactivation"},
            headers=_bearer(user),
        )

        assert response.status_code == 409


class TestReactivateTool:
    """POST /api/v1/tools/{tool_id}/reactivate — permission + conflict cases
    not covered by acceptance/test_us11_admin_deactivate_reactivate.py."""

    async def test_reactivate_tool_non_admin_returns_403(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Non-admin (including the owner) cannot reactivate."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
            name="Stuck Deactivated",
            is_active=False,
            deactivation_reason="Owner can't undo",
        )

        response = await client.post(
            f"/api/v1/tools/{tool.id}/reactivate",
            headers=_bearer(user),
        )

        assert response.status_code == 403

    async def test_reactivate_already_active_returns_409(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Reactivating an already-active tool returns 409 Conflict."""
        admin = await AdminFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=admin.id,
            name="Already Active",
            is_active=True,
        )

        response = await client.post(
            f"/api/v1/tools/{tool.id}/reactivate",
            headers=_bearer(admin),
        )

        assert response.status_code == 409


class TestToolEdgeCases:
    """Field-validation edge cases distinct from acceptance/test_us08's
    "missing field" checks (these use present-but-invalid values)."""

    async def test_create_tool_empty_name_returns_422(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Creating a tool with an empty name returns validation error."""
        user = await UserFactory.create_async(db_session)

        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "",
                "category": "HAND_TOOLS",
                "condition": "GOOD",
                "description": "A hand tool for testing.",
            },
            files=[("photos", _fake_upload_file("tool.jpg"))],
            headers=_bearer(user),
        )

        assert response.status_code == 422

    async def test_update_tool_invalid_condition_returns_422(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """PATCH with an invalid condition value returns validation error."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
        )

        response = await client.patch(
            f"/api/v1/tools/{tool.id}",
            json={"condition": "DESTROYED"},
            headers=_bearer(user),
        )

        assert response.status_code == 422

    async def test_list_tools_empty_when_none_active(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """When all tools are inactive or deleted, list returns empty."""
        user = await UserFactory.create_async(db_session)
        # All inactive
        for i in range(3):
            await ToolFactory.create_async(
                db_session,
                owner_id=user.id,
                name=f"Inactive {i}",
                is_active=False,
            )

        response = await client.get(
            "/api/v1/tools",
            headers=_bearer(user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_create_tool_long_description(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Description up to 5000 chars is accepted."""
        user = await UserFactory.create_async(db_session)
        long_desc = "A" * 5000

        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Max Desc Tool",
                "category": "OUTDOOR_GEAR",
                "condition": "NEW",
                "description": long_desc,
            },
            files=[("photos", _fake_upload_file("max.jpg"))],
            headers=_bearer(user),
        )

        assert response.status_code == 201
        assert response.json()["description"] == long_desc


class TestPhotoUploadSecurity:
    """B5 — photo uploads must validate magic bytes, not just the
    client-supplied Content-Type header."""

    async def test_upload_rejects_content_type_spoofing(
        self, client, db_session: AsyncSession
    ) -> None:
        """An ELF binary with image/jpeg Content-Type is rejected."""
        user = await UserFactory.create_async(db_session)

        # Not a JPEG — starts with ELF magic, declares as image/jpeg.
        fake_elf = b"\x7fELF" + b"\x00" * 200

        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Trojan Drill",
                "category": "POWER_TOOLS",
                "condition": "GOOD",
                "description": "An evil tool.",
            },
            files=[("photos", ("evil.jpg", BytesIO(fake_elf), "image/jpeg"))],
            headers=_bearer(user),
        )
        assert response.status_code == 422
        # Verify the tool was NOT created
        detail = response.json()["detail"]
        assert any(
            "spoofing" in str(d).lower() or "match" in str(d).lower()
            for d in (detail if isinstance(detail, list) else [detail])
        )

    async def test_upload_rejects_non_image_bytes(self, client, db_session: AsyncSession) -> None:
        """Plain text with image/png Content-Type is rejected."""
        user = await UserFactory.create_async(db_session)
        fake_text = b"this is plain text, not an image"

        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Text Disguised as PNG",
                "category": "HAND_TOOLS",
                "condition": "GOOD",
                "description": "A fake PNG test.",
            },
            files=[("photos", ("fake.png", BytesIO(fake_text), "image/png"))],
            headers=_bearer(user),
        )
        assert response.status_code == 422


class TestToolModerationAuditLog:
    """R1.C: every owner/admin tool deactivate + admin reactivate is
    recorded in ``admin_audit_log`` with the right actor_role metadata.

    acceptance/test_us11 checks the admin-actor case's reason/target_id but
    not the owner-actor case or the actor_role metadata field.
    """

    async def test_owner_deactivate_writes_audit_entry(
        self, client, db_session: AsyncSession
    ) -> None:
        """POST /api/v1/tools/{id}/deactivate by owner → TOOL_DEACTIVATED audit row."""
        owner = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id, name="OwnerAuditTest")
        token = create_access_token(owner.id)

        response = await client.post(
            f"/api/v1/tools/{tool.id}/deactivate",
            json={"reason": "vacation"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.target_id == tool.id,
                AdminAuditLog.action_type == "TOOL_DEACTIVATED",
            )
        )
        entry = result.scalar_one()
        assert entry.reason == "vacation"
        assert entry.target_type == "tool"
        assert entry.actor_id == owner.id
        assert entry.metadata_ == {"actor_role": "owner"}

    async def test_admin_deactivate_writes_audit_entry(
        self, client, db_session: AsyncSession
    ) -> None:
        """Admin deactivating a tool → TOOL_DEACTIVATED with actor_role=admin."""
        owner = await UserFactory.create_async(db_session)
        admin = await AdminFactory.create_async(db_session)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id, name="AdminDeactAudit")
        token = create_access_token(admin.id)

        response = await client.post(
            f"/api/v1/tools/{tool.id}/deactivate",
            json={"reason": "policy violation"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.target_id == tool.id,
                AdminAuditLog.action_type == "TOOL_DEACTIVATED",
            )
        )
        entry = result.scalar_one()
        assert entry.actor_id == admin.id
        assert entry.metadata_ == {"actor_role": "admin"}

    async def test_admin_reactivate_writes_audit_entry(
        self, client, db_session: AsyncSession
    ) -> None:
        """POST /api/v1/tools/{id}/reactivate → TOOL_REACTIVATED audit row."""
        owner = await UserFactory.create_async(db_session)
        admin = await AdminFactory.create_async(db_session)
        # Tool starts active so the owner can deactivate it, then admin
        # reactivates. The two transitions are what we want to audit.
        tool = await ToolFactory.create_async(
            db_session, owner_id=owner.id, name="ReactivateAudit", is_active=True
        )
        admin_token = create_access_token(admin.id)
        owner_token = create_access_token(owner.id)

        # Owner deactivates (allowed since they own the tool).
        deact_response = await client.post(
            f"/api/v1/tools/{tool.id}/deactivate",
            json={"reason": "temp"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert deact_response.status_code == 200, deact_response.text

        # Admin reactivates.
        response = await client.post(
            f"/api/v1/tools/{tool.id}/reactivate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(AdminAuditLog)
            .where(AdminAuditLog.target_id == tool.id)
            .order_by(AdminAuditLog.created_at.desc())
        )
        entries = list(result.scalars().all())
        assert len(entries) == 2, f"Expected 2 audit entries, got {len(entries)}"
        # Newest entry is the reactivate.
        assert entries[0].action_type == "TOOL_REACTIVATED"
        assert entries[0].actor_id == admin.id
        assert entries[0].metadata_ == {"actor_role": "admin"}
        # Previous entry is the deactivate.
        assert entries[1].action_type == "TOOL_DEACTIVATED"


class TestAdminListAllTools:
    """GET /api/v1/tools/admin/all — admin-only listing of all tools.

    No user story or acceptance test touches this endpoint at all.
    """

    async def test_admin_can_list_all_tools(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Admin sees all tools across all owners, active and inactive."""
        admin = await AdminFactory.create_async(db_session)
        owner1 = await UserFactory.create_async(db_session)
        owner2 = await UserFactory.create_async(db_session)

        await ToolFactory.create_async(
            db_session, owner_id=owner1.id, name="Active Drill", is_active=True
        )
        await ToolFactory.create_async(
            db_session, owner_id=owner2.id, name="Inactive Saw", is_active=False
        )

        response = await client.get(
            "/api/v1/tools/admin/all",
            headers=_bearer(admin),
        )

        assert response.status_code == 200
        data = response.json()
        names = {t["name"] for t in data["items"]}
        assert "Active Drill" in names
        assert "Inactive Saw" in names
        assert data["total"] >= 2

    async def test_non_admin_cannot_list_all_tools(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Non-admin users receive 403."""
        user = await UserFactory.create_async(db_session)

        response = await client.get(
            "/api/v1/tools/admin/all",
            headers=_bearer(user),
        )

        assert response.status_code == 403

    async def test_filter_inactive_only(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Status filter 'inactive' returns only deactivated tools."""
        admin = await AdminFactory.create_async(db_session)
        owner = await UserFactory.create_async(db_session)

        await ToolFactory.create_async(
            db_session, owner_id=owner.id, name="Active One", is_active=True
        )
        await ToolFactory.create_async(
            db_session, owner_id=owner.id, name="Inactive One", is_active=False
        )

        response = await client.get(
            "/api/v1/tools/admin/all?status=inactive",
            headers=_bearer(admin),
        )

        assert response.status_code == 200
        data = response.json()
        names = {t["name"] for t in data["items"]}
        assert "Inactive One" in names
        assert "Active One" not in names

    async def test_filter_by_category(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Category filter works on admin listing endpoint."""
        admin = await AdminFactory.create_async(db_session)
        owner = await UserFactory.create_async(db_session)

        await ToolFactory.create_async(
            db_session, owner_id=owner.id, name="Drill", category="POWER_TOOLS", is_active=True
        )
        await ToolFactory.create_async(
            db_session, owner_id=owner.id, name="Rake", category="GARDEN_TOOLS", is_active=True
        )

        response = await client.get(
            "/api/v1/tools/admin/all?category=POWER_TOOLS",
            headers=_bearer(admin),
        )

        assert response.status_code == 200
        data = response.json()
        names = {t["name"] for t in data["items"]}
        assert "Drill" in names
        assert "Rake" not in names
