"""FastAPI application factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.config import get_settings
from app.core.exceptions import (
    AppError,
    AuthenticationError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    TooManyRequestsError,
    ValidationError,
)
from app.core.logging import configure_logging, get_logger
from app.services.scheduler import SchedulerService

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: startup and shutdown hooks."""
    settings = get_settings()
    configure_logging()
    logger.info("Starting up %s", settings.app_name)

    # Start APScheduler for auto-cancel and auto-escalation jobs
    scheduler = SchedulerService()
    scheduler.start()

    yield

    scheduler.shutdown()
    logger.info("Shutting down")


def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
    """Map domain exceptions to HTTP responses.

    Mapping is by ``isinstance`` so subclasses of the registered errors
    (e.g. a custom ``ToolNotFoundError(NotFoundError)``) still route to the
    right status code instead of falling through to 500. The first match
    in iteration order wins; the order below is the canonical priority.
    """
    # Order matters: more specific subclasses are listed before their parents
    # so isinstance picks the more specific match. For the current error
    # hierarchy this is irrelevant (no inheritance beyond AppError), but the
    # pattern is correct if the tree ever grows.
    mapping: list[tuple[type[AppError], int]] = [
        (NotFoundError, status.HTTP_404_NOT_FOUND),
        (PermissionDeniedError, status.HTTP_403_FORBIDDEN),
        (ConflictError, status.HTTP_409_CONFLICT),
        (ValidationError, status.HTTP_422_UNPROCESSABLE_ENTITY),
        (AuthenticationError, status.HTTP_401_UNAUTHORIZED),
        (TooManyRequestsError, status.HTTP_429_TOO_MANY_REQUESTS),
    ]
    code = status.HTTP_500_INTERNAL_SERVER_ERROR
    for exc_type, status_code in mapping:
        if isinstance(exc, exc_type):
            code = status_code
            break
    return JSONResponse(
        status_code=code,
        content={
            "detail": exc.message,
            "error_code": type(exc).__name__,
            **exc.details,
        },
    )


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        description="ICS 613 Group 3 backend",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS — explicit allowlist for origins, methods, and headers.
    # `allow_credentials=True` is incompatible with wildcard origins/headers,
    # so every dimension is enumerated here. If you need a new method or
    # header, add it explicitly rather than reverting to `["*"]`.
    #
    # Methods used by the API:
    #   - GET    — most read endpoints
    #   - POST   — creates + state transitions (approve/deny/cancel/mark-*)
    #   - PUT    — /auth/me (profile update); only PUT-using endpoint
    #   - PATCH  — reserved for future partial-update endpoints
    #   - DELETE — /auth/me (self-delete)
    #   - OPTIONS — preflight only (browser-initiated)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Exception handlers
    app.add_exception_handler(AppError, _handle_app_error)  # type: ignore[arg-type]

    # API router
    app.include_router(api_router, prefix="/api/v1")

    # Static files for uploads
    uploads_dir = settings.media_dir / "tool_photos"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

    return app


app = create_application()
