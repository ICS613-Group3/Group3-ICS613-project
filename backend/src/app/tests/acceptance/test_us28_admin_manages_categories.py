"""User Story 28 — Admin Manages Tool Categories.

Covers all four scenarios from the requirements packet:
  1. Admin adds a new category
  2. Admin removes an existing category (no active listings)
  3. Admin cannot remove a category in use by active listings
  4. Non-admin cannot manage categories
"""

import uuid

import pytest

from app.tests.acceptance.helpers import auth_header, make_admin
from app.tests.factories import ToolFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminAddsNewCategory:
    async def test_admin_adds_new_category(self, client, db_session) -> None:
        """S1: Admin adds a new category -> appears in list."""
        admin = await make_admin(db_session)

        resp = await client.post(
            "/api/v1/categories",
            json={"name": "Power Tools", "description": "Electric and battery-powered tools"},
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["name"] == "Power Tools"
        assert body["description"] == "Electric and battery-powered tools"
        assert "id" in body
        assert "created_at" in body

        # Verify it appears in the category list
        resp = await client.get("/api/v1/categories", headers=auth_header(admin.id))
        assert resp.status_code == 200
        names = [c["name"] for c in resp.json()["categories"]]
        assert "Power Tools" in names


class TestScenario2AdminRemovesCategoryNoActiveListings:
    async def test_admin_removes_category_with_no_active_listings(self, client, db_session) -> None:
        """S2: Admin removes a category with no active listings -> removed."""
        admin = await make_admin(db_session)

        # Add a category
        resp = await client.post(
            "/api/v1/categories",
            json={"name": "Ladders"},
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 201
        cat_id = resp.json()["id"]

        # Remove it
        resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=auth_header(admin.id))
        assert resp.status_code == 200, resp.text
        assert "removed" in resp.json()["message"].lower()

        # Verify it's gone from the list
        resp = await client.get("/api/v1/categories", headers=auth_header(admin.id))
        names = [c["name"] for c in resp.json()["categories"]]
        assert "Ladders" not in names


class TestScenario3CannotRemoveCategoryInUse:
    async def test_cannot_remove_category_used_by_active_listings(self, client, db_session) -> None:
        """S3: Admin cannot remove a category used by active listings -> 409."""
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)

        # Create an active tool with HAND_TOOLS category
        await ToolFactory.create_async(
            db_session,
            owner_id=owner.id,
            category="HAND_TOOLS",
            is_active=True,
        )

        # Find the HAND_TOOLS category ID
        resp = await client.get("/api/v1/categories", headers=auth_header(admin.id))
        categories = resp.json()["categories"]
        cat_id = next(c["id"] for c in categories if c["name"] == "HAND_TOOLS")

        # Attempt to remove it
        resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=auth_header(admin.id))
        assert resp.status_code == 409, resp.text
        assert "active" in resp.json()["detail"].lower()


class TestScenario4NonAdminCannotManage:
    async def test_non_admin_gets_403_on_create_and_delete(self, client, db_session) -> None:
        """S4: Non-admin gets 403 on create and delete."""
        user = await UserFactory.create_async(db_session)

        # POST -> 403
        resp = await client.post(
            "/api/v1/categories",
            json={"name": "Should Fail"},
            headers=auth_header(user.id),
        )
        assert resp.status_code == 403

        # DELETE -> 403 (use a random UUID)
        resp = await client.delete(
            f"/api/v1/categories/{uuid.uuid4()}",
            headers=auth_header(user.id),
        )
        assert resp.status_code == 403


class TestScenario5DuplicateCategoryNameRejected:
    async def test_create_duplicate_name_returns_409(self, client, db_session) -> None:
        admin = await make_admin(db_session)

        resp = await client.post(
            "/api/v1/categories",
            json={"name": "Specialty Tools"},
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 201

        dup = await client.post(
            "/api/v1/categories",
            json={"name": "Specialty Tools"},
            headers=auth_header(admin.id),
        )
        assert dup.status_code == 409
        assert "already exists" in dup.json()["detail"].lower()

    async def test_create_duplicate_name_is_case_insensitive(self, client, db_session) -> None:
        admin = await make_admin(db_session)

        resp = await client.post(
            "/api/v1/categories",
            json={"name": "Rental Gear"},
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 201

        dup = await client.post(
            "/api/v1/categories",
            json={"name": "rental gear"},
            headers=auth_header(admin.id),
        )
        assert dup.status_code == 409


class TestScenario6BlankCategoryNameRejected:
    async def test_blank_name_returns_422(self, client, db_session) -> None:
        admin = await make_admin(db_session)

        resp = await client.post(
            "/api/v1/categories",
            json={"name": "   "},
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 422


class TestScenario7RemoveNonexistentCategoryReturns404:
    async def test_remove_nonexistent_category_returns_404(self, client, db_session) -> None:
        admin = await make_admin(db_session)

        resp = await client.delete(
            f"/api/v1/categories/{uuid.uuid4()}",
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 404
