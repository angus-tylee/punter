from fastapi import APIRouter
from app.api import health, panoramas, analytics
# Pulse feature is hibernated - uncomment to re-enable
# from app.api import pulse, instagram

router = APIRouter()

# Include route modules
router.include_router(health.router, tags=["health"])
router.include_router(panoramas.router, tags=["panoramas"])
router.include_router(analytics.router, tags=["analytics"])
# Pulse feature is hibernated - uncomment to re-enable
# router.include_router(pulse.router, tags=["pulse"])
# router.include_router(instagram.router, tags=["instagram"])

