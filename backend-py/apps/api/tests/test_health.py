"""Health check endpoint tests."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    from api.app import app

    return TestClient(app)


def test_health_check(client):
    """Test the health check endpoint returns 200 OK."""
    response = client.get("/healthcheck")
    assert response.status_code == 200
    assert response.json() == {"message": "OK"}
