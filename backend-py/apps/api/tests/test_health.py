"""Health check endpoint tests."""

import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    os.environ.setdefault(
        "POSTGRES_URL",
        "postgresql://postgres:postgres@localhost:54322/postgres",
    )
    os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
    os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "test-key")

    from api.app import app

    return TestClient(app)


def test_health_check(client):
    """Test the health check endpoint returns 200 OK."""
    response = client.get("/healthcheck")
    assert response.status_code == 200
    assert response.json() == {"message": "OK"}
