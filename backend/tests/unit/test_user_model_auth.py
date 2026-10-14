import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.db.database import get_db
from app.models.user import UserModel
import hashlib


def test_auth_login_with_authoritative_user_model():
    client = TestClient(app)

    # 1. Mock UserModel from database
    mock_user = MagicMock(spec=UserModel)
    mock_user.id = "usr-db-001"
    mock_user.email = "lead.fde@calmwork.ai"
    mock_user.name = "Alex Vance"
    mock_user.role = "FDE"
    mock_user.title = "Principal Forward-Deployed Engineer"
    mock_user.password_hash = hashlib.sha256("securePassword123".encode()).hexdigest()
    mock_user.to_dict.return_value = {
        "id": mock_user.id,
        "email": mock_user.email,
        "name": mock_user.name,
        "role": mock_user.role,
        "title": mock_user.title
    }

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # 2. Login with correct credentials
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "lead.fde@calmwork.ai", "password": "securePassword123"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["user"]["email"] == "lead.fde@calmwork.ai"
        assert data["data"]["user"]["name"] == "Alex Vance"
        assert "access_token" in data["data"]
        token = data["data"]["access_token"]

        # 3. Call /auth/me with the issued JWT token
        me_res = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["success"] is True
        assert me_data["data"]["email"] == "lead.fde@calmwork.ai"

        # 4. Invalid password rejected
        bad_res = client.post(
            "/api/v1/auth/login",
            json={"email": "lead.fde@calmwork.ai", "password": "wrongPassword"}
        )
        assert bad_res.status_code == 401
    finally:
        app.dependency_overrides.clear()
