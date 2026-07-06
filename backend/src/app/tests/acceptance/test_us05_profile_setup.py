"""User Story 5 — Set Up Profile.

Note: the API has no dedicated "profile setup" endpoint distinct from "edit
profile" (both are ``PUT /api/v1/auth/me``; see app/api/v1/auth.py). Scenarios
that depend on a setup-vs-edit distinction, or on fields the schema doesn't
have (required display name, photo upload), are marked as gaps below rather
than silently skipped, since they only manifest on the actual UserUpdate
schema (app/schemas/user.py) which currently allows every field to be
optional and unvalidated.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1SetUpProfileAfterFirstLogin:
    async def test_profile_fields_saved_and_visible(
        self, client, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create_async(db_session, full_name=None)

        response = await client.put(
            "/api/v1/auth/me",
            json={
                "full_name": "Jordan Kim",
                "bio": "I lend power tools on weekends.",
                "neighborhood": "Manoa",
            },
            headers=auth_header(user.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Jordan Kim"
        assert data["bio"] == "I lend power tools on weekends."
        assert data["neighborhood"] == "Manoa"


class TestScenario2DisplayNameMissingOrBlank:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: UserService.update_profile (app/services/user.py) only "
        "applies full_name when it is not None -- it never rejects blank/whitespace "
        "values, and UserUpdate has no validator requiring non-blank full_name. A "
        "whitespace-only name is currently accepted and saved as-is.",
    )
    async def test_blank_display_name_is_rejected(
        self, client, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create_async(db_session, full_name="Original Name")

        response = await client.put(
            "/api/v1/auth/me",
            json={"full_name": "   "},
            headers=auth_header(user.id),
        )

        assert response.status_code == 422
        await db_session.refresh(user)
        assert user.full_name == "Original Name"


class TestScenario3DisplayNameExceedsMaxLength:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: UserUpdate.full_name (app/schemas/user.py) has no max_length "
        "constraint, so a 500+ character name is accepted today.",
    )
    async def test_overlong_display_name_is_rejected(
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
        reason="not implemented: there is no profile-photo upload endpoint. "
        "UserUpdate.photo_url (app/schemas/user.py) is a plain string field set "
        "directly to whatever URL the client sends -- no file upload, no image/size "
        "validation exists for user profile photos (tool listing photos have their "
        "own separate upload+validation path in app/api/v1/tools.py)."
    )
    async def test_non_image_or_oversized_photo_rejected(self) -> None:
        raise NotImplementedError


class TestScenario5UnauthenticatedCannotAccessProfileSetup:
    async def test_returns_401(self, client) -> None:
        response = await client.put(
            "/api/v1/auth/me", json={"full_name": "Someone"}
        )
        assert response.status_code == 401


class TestScenario6AlreadyCompletedProfileRedirectsToEdit:
    @pytest.mark.skip(
        reason="not implemented: there is only one PUT /auth/me endpoint used for "
        "both initial setup and later edits -- there is no 'profile completed' flag "
        "or distinct setup route to redirect away from. This is a frontend routing "
        "concern once such a flag exists, not currently API-testable."
    )
    async def test_redirects_to_edit_profile(self) -> None:
        raise NotImplementedError
