"""Tests for tool CRUD endpoints."""

import uuid
from io import BytesIO

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.admin_audit_log import AdminAuditLog
from app.models.enums import ToolCategory, ToolCondition
from app.tests.factories import AdminFactory, ToolFactory, UserFactory

# ── helpers ──────────────────────────────────────────────────────────────


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


# ── Create ────────────────────────────────────────────────────────────────


class TestCreateTool:
    """POST /api/v1/tools"""

    async def test_create_tool_happy_path(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """An authenticated user can create a tool via multipart form."""
        user = await UserFactory.create_async(db_session)

        # NOTE: must include at least one photo because create_tool's
        # db.refresh(tool) expires lazy relationships; ToolResponse validation
        # needs photos to be eagerly loaded or at least not expired.
        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Cordless Drill",
                "category": "POWER_TOOLS",
                "condition": "GOOD",
                "description": "A reliable cordless drill with two batteries.",
            },
            files=[("photos", _fake_upload_file("drill.jpg"))],
            headers=_bearer(user),
        )

        assert response.status_code == 201
        tool = response.json()
        assert tool["name"] == "Cordless Drill"
        assert tool["category"] == "POWER_TOOLS"
        assert tool["condition"] == "GOOD"
        assert tool["description"] == "A reliable cordless drill with two batteries."
        assert tool["owner_id"] == str(user.id)
        # OwnerSummary should be embedded in the create response too
        assert tool["owner"]["id"] == str(user.id)
        assert tool["owner"]["full_name"] == user.full_name
        assert "photo_url" in tool["owner"]
        assert tool["is_active"] is True
        assert len(tool["photos"]) == 1

    async def test_create_tool_with_photos(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """An authenticated user can create a tool with photos."""
        user = await UserFactory.create_async(db_session)

        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Lawn Mower",
                "category": "GARDEN_TOOLS",
                "condition": "FAIR",
            },
            files=[("photos", _fake_upload_file("mower.jpg"))],
            headers=_bearer(user),
        )

        assert response.status_code == 201
        tool = response.json()
        assert tool["name"] == "Lawn Mower"
        assert len(tool["photos"]) == 1
        assert tool["photos"][0]["display_order"] == 1
        # OwnerSummary should be embedded on create-with-photos too
        assert tool["owner"]["id"] == str(user.id)
        assert tool["owner"]["full_name"] == user.full_name

    async def test_create_tool_without_auth_returns_401(
        self,
        client,
    ) -> None:
        """An unauthenticated request must be rejected."""
        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Hammer",
                "category": "HAND_TOOLS",
                "condition": "GOOD",
            },
        )
        assert response.status_code == 401


# ── List ──────────────────────────────────────────────────────────────────


class TestListTools:
    """GET /api/v1/tools"""

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
                category=ToolCategory.HAND_TOOLS,
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

    async def test_list_tools_filter_by_category(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Filter tools by category; browsing user's own tools are excluded."""
        owner = await UserFactory.create_async(db_session)
        browser = await UserFactory.create_async(db_session)
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Drill",
            category=ToolCategory.POWER_TOOLS,
            is_active=True,
        )
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Rake",
            category=ToolCategory.GARDEN_TOOLS,
            is_active=True,
        )

        response = await client.get(
            "/api/v1/tools?category=POWER_TOOLS",
            headers=_bearer(browser),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Drill"

    async def test_list_tools_filter_by_search(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Search tools by name or description; browsing user's own tools are excluded."""
        owner = await UserFactory.create_async(db_session)
        browser = await UserFactory.create_async(db_session)
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Electric Saw",
            description="Cuts wood cleanly",
            category=ToolCategory.POWER_TOOLS,
            is_active=True,
        )
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Garden Shovel",
            description="Digs holes easily",
            category=ToolCategory.GARDEN_TOOLS,
            is_active=True,
        )

        response = await client.get(
            "/api/v1/tools?search=saw",
            headers=_bearer(browser),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Electric Saw"

        # Search in description
        response2 = await client.get(
            "/api/v1/tools?search=digs",
            headers=_bearer(browser),
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["total"] == 1
        assert data2["items"][0]["name"] == "Garden Shovel"

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


# ── My tools ──────────────────────────────────────────────────────────────


class TestMyTools:
    """GET /api/v1/tools/me"""

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

    async def test_list_my_tools_empty_state(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """A member who owns no tools gets an empty list, not an error."""
        owner = await UserFactory.create_async(db_session)

        response = await client.get(
            "/api/v1/tools/me",
            headers=_bearer(owner),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_my_tools_requires_auth(self, client) -> None:
        """Unauthenticated requests to /tools/me are rejected."""
        response = await client.get("/api/v1/tools/me")
        assert response.status_code == 401


# ── Get single ────────────────────────────────────────────────────────────


class TestGetTool:
    """GET /api/v1/tools/{tool_id}"""

    async def test_get_tool(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Get a single active tool by id."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
            name="Precision Screwdriver Set",
            category=ToolCategory.HAND_TOOLS,
            condition=ToolCondition.NEW,
            is_active=True,
        )

        response = await client.get(
            f"/api/v1/tools/{tool.id}",
            headers=_bearer(user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(tool.id)
        assert data["name"] == "Precision Screwdriver Set"
        assert data["category"] == "HAND_TOOLS"
        assert data["condition"] == "NEW"
        assert data["owner_id"] == str(user.id)
        # OwnerSummary should be embedded with id + name (User Story 12)
        assert data["owner"]["id"] == str(user.id)
        assert data["owner"]["full_name"] == user.full_name
        assert "photo_url" in data["owner"]

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


# ── Update ────────────────────────────────────────────────────────────────


class TestUpdateTool:
    """PATCH /api/v1/tools/{tool_id}"""

    async def test_update_tool_owner(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Owner can update their tool via JSON body."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
            name="Old Name",
            description="Old desc",
            category=ToolCategory.HAND_TOOLS,
            condition=ToolCondition.GOOD,
        )

        response = await client.patch(
            f"/api/v1/tools/{tool.id}",
            json={
                "name": "Updated Name",
                "description": "Updated desc",
                "condition": "LIKE_NEW",
            },
            headers=_bearer(user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated desc"
        assert data["condition"] == "LIKE_NEW"
        # category not sent → unchanged
        assert data["category"] == "HAND_TOOLS"

    async def test_update_tool_non_owner_returns_403(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Non-owner cannot update someone else's tool."""
        owner = await UserFactory.create_async(db_session)
        other = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Owner's Tool",
        )

        response = await client.patch(
            f"/api/v1/tools/{tool.id}",
            json={"name": "Hijacked"},
            headers=_bearer(other),
        )

        assert response.status_code == 403

    async def test_update_tool_partial(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Partial update with only name keeps other fields."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
            name="Original",
            category=ToolCategory.CLEANING_TOOLS,
            condition=ToolCondition.FAIR,
        )

        response = await client.patch(
            f"/api/v1/tools/{tool.id}",
            json={"name": "Renamed Only"},
            headers=_bearer(user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Renamed Only"
        assert data["category"] == "CLEANING_TOOLS"
        assert data["condition"] == "FAIR"


# ── Delete ────────────────────────────────────────────────────────────────


class TestDeleteTool:
    """DELETE /api/v1/tools/{tool_id}"""

    async def test_delete_tool_owner_no_reservations(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Owner can soft-delete a tool with no active reservations."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
            name="Disposable Tool",
        )

        response = await client.delete(
            f"/api/v1/tools/{tool.id}",
            headers=_bearer(user),
        )

        assert response.status_code == 204

        # Verify tool is soft-deleted (not returned by GET)
        get_response = await client.get(
            f"/api/v1/tools/{tool.id}",
            headers=_bearer(user),
        )
        assert get_response.status_code == 404

    async def test_delete_tool_non_owner_returns_403(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Non-owner cannot delete someone else's tool."""
        owner = await UserFactory.create_async(db_session)
        other = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Keep This",
        )

        response = await client.delete(
            f"/api/v1/tools/{tool.id}",
            headers=_bearer(other),
        )

        assert response.status_code == 403

    async def test_delete_tool_without_auth(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Deleting without auth returns 401."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
        )

        response = await client.delete(f"/api/v1/tools/{tool.id}")
        assert response.status_code == 401


# ── Deactivate ────────────────────────────────────────────────────────────


class TestDeactivateTool:
    """POST /api/v1/tools/{tool_id}/deactivate"""

    async def test_deactivate_tool_owner_with_reason(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Owner can deactivate their tool with a reason."""
        user = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
            name="Take a Break",
            is_active=True,
        )

        response = await client.post(
            f"/api/v1/tools/{tool.id}/deactivate",
            json={"reason": "Going on vacation for two weeks"},
            headers=_bearer(user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
        assert data["deactivation_reason"] == "Going on vacation for two weeks"
        assert data["deactivated_by"] == "OWNER"
        assert data["deactivated_at"] is not None

    async def test_deactivate_tool_non_owner_returns_403(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Non-owner cannot deactivate someone else's tool."""
        owner = await UserFactory.create_async(db_session)
        other = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Not Yours",
            is_active=True,
        )

        response = await client.post(
            f"/api/v1/tools/{tool.id}/deactivate",
            json={"reason": "I want to disable this"},
            headers=_bearer(other),
        )

        assert response.status_code == 403

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

    async def test_deactivate_tool_admin_can_deactivate(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """An admin can deactivate any tool (not just their own)."""
        owner = await UserFactory.create_async(db_session)
        admin = await AdminFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Policy Violation",
            is_active=True,
        )

        response = await client.post(
            f"/api/v1/tools/{tool.id}/deactivate",
            json={"reason": "Violates community guidelines"},
            headers=_bearer(admin),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
        assert data["deactivated_by"] == "ADMIN"
        assert data["deactivation_reason"] == "Violates community guidelines"


# ── Reactivate ────────────────────────────────────────────────────────────


class TestReactivateTool:
    """POST /api/v1/tools/{tool_id}/reactivate"""

    async def test_reactivate_tool_admin(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Admin can reactivate a deactivated tool."""
        user = await UserFactory.create_async(db_session)
        admin = await AdminFactory.create_async(db_session)
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=user.id,
            name="Restored Tool",
            is_active=False,
            deactivation_reason="Temporary hold",
        )

        response = await client.post(
            f"/api/v1/tools/{tool.id}/reactivate",
            headers=_bearer(admin),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is True
        assert data["deactivated_by"] is None
        assert data["deactivated_at"] is None
        assert data["deactivation_reason"] is None

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


# ── Edge cases ────────────────────────────────────────────────────────────


class TestToolEdgeCases:
    """Additional edge case coverage."""

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
            },
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

    async def test_get_tool_includes_photos(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Tool response includes its photo gallery."""
        user = await UserFactory.create_async(db_session)

        # Create with photos
        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Visual Tool",
                "category": "CLEANING_TOOLS",
                "condition": "GOOD",
            },
            files=[("photos", _fake_upload_file("img1.jpg"))],
            headers=_bearer(user),
        )
        tool = response.json()
        tool_id = tool["id"]

        # GET the tool
        get_response = await client.get(
            f"/api/v1/tools/{tool_id}",
            headers=_bearer(user),
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert len(data["photos"]) == 1
        photo = data["photos"][0]
        assert "id" in photo
        assert "url" in photo
        assert photo["display_order"] == 1


class TestPhotoUploadSecurity:
    """B5 — photo uploads must validate magic bytes, not just the
    client-supplied Content-Type header."""

    async def test_upload_rejects_content_type_spoofing(
        self, client, db_session: AsyncSession
    ) -> None:
        """An ELF binary with image/jpeg Content-Type is rejected."""
        from app.tests.factories import UserFactory

        user = await UserFactory.create_async(db_session)

        # Not a JPEG — starts with ELF magic, declares as image/jpeg.
        fake_elf = b"\x7fELF" + b"\x00" * 200

        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Trojan Drill",
                "category": "POWER_TOOLS",
                "condition": "GOOD",
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
        from app.tests.factories import UserFactory

        user = await UserFactory.create_async(db_session)
        fake_text = b"this is plain text, not an image"

        response = await client.post(
            "/api/v1/tools",
            data={
                "name": "Text Disguised as PNG",
                "category": "HAND_TOOLS",
                "condition": "GOOD",
            },
            files=[("photos", ("fake.png", BytesIO(fake_text), "image/png"))],
            headers=_bearer(user),
        )
        assert response.status_code == 422


class TestAddPhotosResponseShape:
    """M8 regression coverage: ``POST /tools/{id}/photos`` returns the new photos.

    The route calls ``db.refresh(tool, ["photos"])`` after upload so the
    response includes the newly-added photos. If a future refactor breaks
    that refresh (or removes the relationship from the response model),
    the test below catches it.
    """

    async def test_added_photos_appear_in_response(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        owner_token = create_access_token(owner.id)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        response = await client.post(
            f"/api/v1/tools/{tool.id}/photos",
            files=[("photos", _fake_upload_file("a.jpg"))],
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["id"] == str(tool.id)
        assert "photos" in body, f"Response missing 'photos' key: {body}"
        assert len(body["photos"]) == 1, f"Expected 1 photo in response, got {body['photos']!r}"
        assert body["photos"][0]["url"].startswith("/uploads/")
        assert body["photos"][0]["url"].endswith(".jpg")


class TestToolModerationAuditLog:
    """R1.C: every owner/admin tool deactivate + admin reactivate is
    recorded in ``admin_audit_log`` with the right actor_role metadata.

    These tests protect the R1.C verification checklist item
    "Audit-log rows are inserted on every admin/owner deactivate
    and reactivate".
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
    """GET /api/v1/tools/admin/all — admin-only listing of all tools."""

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
            db_session,
            owner_id=owner.id,
            name="Drill",
            category=ToolCategory.POWER_TOOLS,
            is_active=True,
        )
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            name="Rake",
            category=ToolCategory.GARDEN_TOOLS,
            is_active=True,
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
