"""Authentication and identity endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_current_member, get_db
from app.dependencies_rate_limit import (
    rate_limit_forgot_password,
    rate_limit_login,
    rate_limit_register,
    rate_limit_resend_verification,
)
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    InviteCreate,
    InviteResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendRequest,
    ResetPasswordRequest,
    TokenPairResponse,
    VerifyEmailRequest,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserProfile, UserUpdate
from app.services.auth import AuthService

router = APIRouter()


@router.post("/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    request_data: InviteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_current_admin_user)],
) -> InviteResponse:
    """Admin-only: create an invite token for a new member."""
    service = AuthService()
    invite = await service.create_invite(
        db,
        email=request_data.email,
        admin_user=admin_user,
    )
    return InviteResponse.model_validate(invite)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request_data: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rl: Annotated[None, Depends(rate_limit_register)] = None,
) -> MessageResponse:
    """Register a new account using a valid invite token."""
    service = AuthService()
    await service.register(
        db,
        email=request_data.email,
        password=request_data.password,
        full_name=request_data.full_name,
        invite_token_str=request_data.invite_token,
    )
    return MessageResponse(
        message="Registration successful. Please check your email to verify your account.",
    )


@router.post("/verify-email", response_model=TokenPairResponse)
async def verify_email(
    request_data: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPairResponse:
    """Verify an email address using a verification token."""
    service = AuthService()
    tokens = await service.verify_email(db, token_str=request_data.token)
    return TokenPairResponse(**tokens)


@router.post("/resend-verification")
async def resend_verification(
    request_data: ResendRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rl: Annotated[None, Depends(rate_limit_resend_verification)] = None,
) -> MessageResponse:
    """Resend the verification email (always returns 200)."""
    service = AuthService()
    await service.resend_verification(db, email=request_data.email)
    return MessageResponse(
        message="If an account with that email exists, a verification email has been sent.",
    )


@router.post("/login", response_model=TokenPairResponse)
async def login(
    request_data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rl: Annotated[None, Depends(rate_limit_login)] = None,
) -> TokenPairResponse:
    """Log in with email and password."""
    service = AuthService()
    tokens = await service.login(db, email=request_data.email, password=request_data.password)
    return TokenPairResponse(**tokens)


@router.post("/refresh", response_model=TokenPairResponse)
async def refresh(
    request_data: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPairResponse:
    """Rotate a refresh token into a new access/refresh pair."""
    service = AuthService()
    tokens = await service.refresh(db, refresh_token_str=request_data.refresh_token)
    return TokenPairResponse(**tokens)


@router.post("/logout")
async def logout(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> MessageResponse:
    """Stateless logout hook."""
    service = AuthService()
    await service.logout(db, current_user)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserProfile)
async def get_me(
    current_user: Annotated[User, Depends(get_current_member)],
) -> UserProfile:
    """Return the current user's profile."""
    return UserProfile.model_validate(current_user)


@router.put("/me", response_model=UserProfile)
async def update_me(
    request_data: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> UserProfile:
    """Update the current user's profile."""
    service = AuthService()
    updated_user = await service.update_me(
        db,
        current_user,
        full_name=request_data.full_name,
        bio=request_data.bio,
        neighborhood=request_data.neighborhood,
        photo_url=request_data.photo_url,
    )
    return UserProfile.model_validate(updated_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> None:
    """Soft-delete the current user's account."""
    service = AuthService()
    await service.delete_me(db, current_user)


@router.post("/forgot-password")
async def forgot_password(
    request_data: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rl: Annotated[None, Depends(rate_limit_forgot_password)] = None,
) -> MessageResponse:
    """Request a password reset email (always returns 200)."""
    service = AuthService()
    await service.forgot_password(db, email=request_data.email)
    return MessageResponse(
        message="If an account with that email exists, a reset email has been sent.",
    )


@router.post("/reset-password", response_model=TokenPairResponse)
async def reset_password(
    request_data: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPairResponse:
    """Reset a password using a reset token."""
    service = AuthService()
    tokens = await service.reset_password(
        db,
        token_str=request_data.token,
        new_password=request_data.new_password,
    )
    return TokenPairResponse(**tokens)
