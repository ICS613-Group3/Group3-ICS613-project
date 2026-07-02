"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.reservations import router as reservations_router
from app.api.v1.reviews import router as reviews_router
from app.api.v1.tools import router as tools_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(tools_router, prefix="/tools", tags=["tools"])
api_router.include_router(reservations_router, prefix="/reservations", tags=["reservations"])
api_router.include_router(reviews_router, tags=["reviews"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
