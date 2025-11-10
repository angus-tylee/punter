from fastapi import APIRouter
from app.api import health

router = APIRouter()

# Include route modules
router.include_router(health.router, tags=["health"])

