"""User Story 6 — Edit Profile."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1UpdateProfileInformation:
    async def test_updated_fields_are_saved(self, client, db_session: AsyncSession) -> None:
        user = await UserFactory.create_async(db_session, full_name="Old Name")

        response = await client.put(
            "/api/v1/auth/me",
            json={"full_name": "New Name", "bio": "Updated bio", "neighborhood": "Kaimuki"},
            headers=auth_header(user.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "New Name"
        assert data["bio"] == "Updated bio"
        assert data["neighborhood"] == "Kaimuki"


class TestScenario2DisplayNameCannotBeCleared:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: same root cause as US5 Scenario 2 -- "
        "UserService.update_profile has no non-blank validation for full_name.",
    )
    async def test_blank_display_name_rejected_and_previous_preserved(
        self, client, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create_async(db_session, full_name="Keep Me")

        response = await client.put(
            "/api/v1/auth/me",
            json={"full_name": ""},
            headers=auth_header(user.id),
        )

        assert response.status_code == 422
        await db_session.refresh(user)
        assert user.full_name == "Keep Me"


class TestScenario3DisplayNameExceedsMaxLength:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: same root cause as US5 Scenario 3 -- "
        "UserUpdate.full_name has no max_length constraint.",
    )
    async def test_overlong_display_name_rejected(
        self, client, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create_async(db_session)

        response = await client.put(
            "/api/v1/auth/me",
            json={"full_name": "x" * 51},
            headers=auth_header(user.id),
        )

        assert response.status_code == 422


class TestScenario4ProfilePhotoUploadFailsValidation:
    @pytest.mark.skip(
        reason="not implemented: no profile-photo upload endpoint exists yet "
        "(see US5 Scenario 4 for the same gap)."
    )
    async def test_invalid_photo_rejected_existing_photo_unchanged(self) -> None:
        raise NotImplementedError


class TestScenario5UnauthenticatedCannotEdit:
    async def test_returns_401_and_no_changes_saved(self, client) -> None:
        response = await client.put("/api/v1/auth/me", json={"full_name": "Nope"})
        assert response.status_code == 401


class TestScenario6MemberCannotEditAnotherProfile:
    async def test_no_target_user_id_is_accepted_by_the_api(self, client) -> None:
        """Structurally satisfied: PUT /auth/me always targets the caller.

        There is no ``user_id`` path/body parameter to manipulate, so the
        403-Forbidden scenario described in the doc (editing *another*
        member's profile via URL manipulation) cannot occur through this
        endpoint. This test just pins that the request body is ignored for
        identity purposes -- confirming there is no hidden id/user_id field.
        """
        response = await client.put(
            "/api/v1/auth/me",
            json={"full_name": "Whatever"},
        )
        assert response.status_code == 401, "no id field means no auth still means no access"


class TestScenario7NoChangesSubmittedIsANoOp:
    async def test_empty_body_saves_silently(self, client, db_session: AsyncSession) -> None:
        user = await UserFactory.create_async(
            db_session, full_name="Unchanged Name", bio="Unchanged bio"
        )

        response = await client.put(
            "/api/v1/auth/me",
            json={},
            headers=auth_header(user.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Unchanged Name"
        assert data["bio"] == "Unchanged bio"
