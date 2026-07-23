"""User Story 28 — Admin Manages Tool Categories.

Covers all four scenarios from the requirements packet:
  1. Admin adds a new category
  2. Admin removes an existing category (no active listings)
  3. Admin cannot remove a category in use by active listings
  4. Non-admin cannot manage categories
"""

import uuid

import pytest

from app.core.security import create_access_token
from app.tests.acceptance.helpers import fake_photo
from app.tests.factories import AdminFactory, ToolFactory, UserFactory


def _bearer(user) -> dict:
    """Return an Authorization header dict for *user*."""
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


class TestUS28AdminManagesCategories:
    """Acceptance tests for US28 — Admin Manages Tool Categories."""

    @pytest.mark.asyncio
    async def test_scenario1_admin_adds_new_category(self, client, db_session):
        """S1: Admin adds a new category -> appears in list."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)

        resp = await client.post(
            "/api/v1/categories",
            json={"name": "Power Tools", "description": "Electric and battery-powered tools"},
            headers=token,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["name"] == "Power Tools"
        assert body["description"] == "Electric and battery-powered tools"
        assert "id" in body
        assert "created_at" in body

        # Verify it appears in the category list
        resp = await client.get("/api/v1/categories", headers=token)
        assert resp.status_code == 200
        names = [c["name"] for c in resp.json()["categories"]]
        assert "Power Tools" in names

    @pytest.mark.asyncio
    async def test_scenario2_admin_removes_category_no_active_listings(self, client, db_session):
        """S2: Admin removes a category with no active listings -> removed."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)

        # Add a category
        resp = await client.post(
            "/api/v1/categories",
            json={"name": "Ladders"},
            headers=token,
        )
        assert resp.status_code == 201
        cat_id = resp.json()["id"]

        # Remove it
        resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=token)
        assert resp.status_code == 200, resp.text
        assert "removed" in resp.json()["message"].lower()

        # Verify it's gone from the list
        resp = await client.get("/api/v1/categories", headers=token)
        names = [c["name"] for c in resp.json()["categories"]]
        assert "Ladders" not in names

    @pytest.mark.asyncio
    async def test_scenario3_cannot_remove_category_in_use(self, client, db_session):
        """S3: Admin cannot remove a category used by active listings -> 409."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)
        owner = await UserFactory.create_async(db_session)

        # Create an active tool with HAND_TOOLS category
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            category="HAND_TOOLS",
            is_active=True,
        )

        # Find the HAND_TOOLS category ID
        resp = await client.get("/api/v1/categories", headers=token)
        categories = resp.json()["categories"]
        cat_id = next(c["id"] for c in categories if c["name"] == "HAND_TOOLS")

        # Attempt to remove it
        resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=token)
        assert resp.status_code == 409, resp.text
        assert "active" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_scenario4_non_admin_cannot_manage(self, client, db_session):
        """S4: Non-admin gets 403 on create and delete."""
        user = await UserFactory.create_async(db_session)
        token = _bearer(user)

        # POST -> 403
        resp = await client.post(
            "/api/v1/categories",
            json={"name": "Should Fail"},
            headers=token,
        )
        assert resp.status_code == 403

        # DELETE -> 403 (use a random UUID)
        resp = await client.delete(
            f"/api/v1/categories/{uuid.uuid4()}",
            headers=token,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_duplicate_category_rejected(self, client, db_session):
        """Extra: duplicate category (case-insensitive) -> 409."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)

        # Adding "HAND_TOOLS" again should fail (already seeded).
        resp = await client.post(
            "/api/v1/categories",
            json={"name": "HAND_TOOLS"},
            headers=token,
        )
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_any_member_can_list_categories(self, client, db_session):
        """Extra: any authenticated member can list categories (read-only)."""
        user = await UserFactory.create_async(db_session)
        token = _bearer(user)

        resp = await client.get("/api/v1/categories", headers=token)
        assert resp.status_code == 200
        names = [c["name"] for c in resp.json()["categories"]]
        assert "HAND_TOOLS" in names

    @pytest.mark.asyncio
    async def test_tool_creation_validates_category(self, client, db_session):
        """Extra: creating a tool with an unlisted category -> 422."""
        owner = await UserFactory.create_async(db_session)
        token = _bearer(owner)

        resp = await client.post(
            "/api/v1/tools",
            data={
                "name": "Mystery Tool",
                "category": "NONEXISTENT_CATEGORY",
                "condition": "GOOD",
                "description": "A mystery tool for testing.",
            },
            files=[("photos", fake_photo("mystery.jpg"))],
            headers=token,
        )
        assert resp.status_code == 422
        detail = resp.json().get("detail", "")
        if isinstance(detail, list):
            # FastAPI validation error — check across all error messages
            messages = " ".join(e.get("msg", "") for e in detail)
        else:
            messages = detail
        assert "allowed categories" in messages.lower() or "category" in messages.lower()

    @pytest.mark.asyncio
    async def test_deactivated_listing_retains_category(self, client, db_session):
        """S2 continuation: deactivated listings keep the old category string."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)
        owner = await UserFactory.create_async(db_session)

        # Create an active tool, then deactivate it
        tool = await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            category="GARDEN_TOOLS",
            is_active=True,
        )
        tool.is_active = False
        db_session.add(tool)
        await db_session.flush()

        # Now we should be able to remove GARDEN_TOOLS (no active listings)
        resp = await client.get("/api/v1/categories", headers=token)
        categories = resp.json()["categories"]
        cat_id = next(c["id"] for c in categories if c["name"] == "GARDEN_TOOLS")

        resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=token)
        assert resp.status_code == 200, resp.text

        # The deactivated tool still has "GARDEN_TOOLS" as its category string
        await db_session.refresh(tool)
        assert tool.category == "GARDEN_TOOLS"
