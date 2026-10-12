import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token

client = TestClient(app)


def test_manager_can_create_new_engagement():
    manager_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    headers = {"Authorization": f"Bearer {manager_token}"}
    payload = {
        "customer_name": "Wayne Enterprises",
        "name": "Cloud Security Ingestion",
        "description": "Real-time telemetry and compliance pipeline",
        "initial_outcome_statement": "Automate compliance validation with 99.9% uptime.",
        "success_criteria": ["Ingestion ready", "Security validated"]
    }
    
    response = client.post("/api/v1/engagements", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["customer_name"] == "Wayne Enterprises"
    assert data["data"]["status"] == "HEALTHY"
    assert data["data"]["version"] == 1


def test_fde_cannot_create_new_engagement():
    fde_token = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE"})
    headers = {"Authorization": f"Bearer {fde_token}"}
    payload = {
        "customer_name": "Rogue Entity",
        "name": "Unauthorized Project"
    }
    
    response = client.post("/api/v1/engagements", json=payload, headers=headers)
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]


def test_created_engagement_visible_in_engagements_list():
    response = client.get("/api/v1/engagements")
    assert response.status_code == 200
    names = [e["customer_name"] for e in response.json()["data"]]
    assert "Wayne Enterprises" in names
