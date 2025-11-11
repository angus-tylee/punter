from fastapi import APIRouter
from app.api import health, panoramas

router = APIRouter()

# Include route modules
router.include_router(health.router, tags=["health"])
router.include_router(panoramas.router, tags=["panoramas"])

