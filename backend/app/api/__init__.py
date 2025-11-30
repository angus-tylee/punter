from fastapi import APIRouter
from app.api import health, panoramas, analytics, events

router = APIRouter()

# Include route modules
router.include_router(health.router, tags=["health"])
router.include_router(panoramas.router, tags=["panoramas"])
router.include_router(analytics.router, tags=["analytics"])
router.include_router(events.router, tags=["events"])

