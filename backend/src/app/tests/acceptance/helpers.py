"""Shared helpers for acceptance tests (not a test module itself)."""

import uuid
from io import BytesIO
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.email_verification import EmailVerificationToken
from app.models.user import User
from app.services.email import EmailService
from app.tests.factories import AdminFactory, InviteFactory

# Minimal 1x1 white JPEG -- valid enough to pass magic-byte validation.
_FAKE_JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\x09\x09"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e"
    b"\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00"
    b"\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00"
    b"\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00"
    b"\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00"
    b"\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07\"q\x142"
    b"\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18"
    b"\x19\x1a%&'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz"
    b"\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99"
    b"\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7"
    b"\xb8\xb9\xba\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5"
    b"\xd6\xd7\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1"
    b"\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01\x00"
    b"\x00?\x00\xd2\xcf \xff\xd9"
)


def fake_photo(filename: str = "photo.jpg") -> tuple[str, BytesIO, str]:
    """Return an (filename, bytes, content_type) tuple suitable for httpx ``files=``."""
    return (filename, BytesIO(_FAKE_JPEG_BYTES), "image/jpeg")


async def create_tool(
    client: AsyncClient,
    owner: User,
    *,
    name: str = "Test Tool",
    category: str = "POWER_TOOLS",
    condition: str = "GOOD",
    description: str | None = "A tool for testing.",
    num_photos: int = 1,
) -> dict:
    """Create a tool listing via the multipart create endpoint. Returns the JSON body."""
    data = {"name": name, "category": category, "condition": condition}
    if description is not None:
        data["description"] = description
    files = [("photos", fake_photo(f"photo{i}.jpg")) for i in range(num_photos)]
    response = await client.post(
        "/api/v1/tools",
        data=data,
        files=files or None,
        headers=auth_header(owner.id),
    )
    assert response.status_code == 201, response.text
    return response.json()


def unique_email(prefix: str = "qa") -> str:
    return f"{prefix}+{uuid.uuid4().hex[:12]}@example.com"


def auth_header(user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


async def make_admin(db_session: AsyncSession) -> User:
    return await AdminFactory.create_async(db_session)


async def invite_email(db_session: AsyncSession, email: str, admin: User) -> str:
    """Create a SENT invite token for ``email`` and return the raw token string."""
    invite = await InviteFactory.create_async(db_session, email=email, created_by=admin.id)
    return invite.token


async def register_and_verify(
    client: AsyncClient,
    db_session: AsyncSession,
    *,
    email: str,
    password: str = "Password123!",
    full_name: str | None = "QA Test User",
    admin: User | None = None,
) -> User:
    """Full Story-1 + Story-2 happy path: invite -> register -> verify.

    Returns the now-ACTIVE ``User`` row.
    """
    admin = admin or await make_admin(db_session)
    token = await invite_email(db_session, email, admin)

    with patch.object(EmailService, "send_verification_email", AsyncMock()):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": full_name,
                "invite_token": token,
            },
        )
    assert response.status_code == 201, response.text

    pending_user = (
        await db_session.execute(select(User).where(User.email == email.lower()))
    ).scalar_one()
    verification_token = (
        await db_session.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == pending_user.id
            )
        )
    ).scalar_one()

    verify_response = await client.post(
        "/api/v1/auth/verify-email",
        json={"token": verification_token.token},
    )
    assert verify_response.status_code == 200, verify_response.text

    user = (
        await db_session.execute(select(User).where(User.email == email.lower()))
    ).scalar_one()
    return user
