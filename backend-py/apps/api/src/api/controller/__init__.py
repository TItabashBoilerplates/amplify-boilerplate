"""Top-level controller package: aggregates feature routers.

Each feature router declares its own `prefix` / `tags` at the router level
(see FastAPI best practice: avoid passing them to `include_router()`).
"""

from fastapi import APIRouter

from api.controller.base_controller import router as base_router

router = APIRouter()
router.include_router(base_router)
