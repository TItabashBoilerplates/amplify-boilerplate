"""Liveness / health probe endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["base"])


class HealthCheckResponse(BaseModel):
    """Response payload for the health check endpoint."""

    message: str


@router.get("/healthcheck")
async def healthcheck() -> HealthCheckResponse:
    return HealthCheckResponse(message="OK")
