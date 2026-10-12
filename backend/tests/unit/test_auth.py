import pytest
from fastapi import HTTPException
from app.auth import create_access_token, decode_access_token, verify_password, DEMO_USERS, require_role


def test_password_hashing():
    fde = DEMO_USERS["fde@calmwork.ai"]
    assert verify_password("password123", fde["password_hash"]) is True
    assert verify_password("wrongpassword", fde["password_hash"]) is False


def test_jwt_token_generation_and_decoding():
    token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "manager@calmwork.ai"
    assert payload["role"] == "MANAGER"


@pytest.mark.anyio
async def test_require_role_rbac_permits_manager():
    manager_user = DEMO_USERS["manager@calmwork.ai"]
    checker = require_role(["MANAGER"])
    res = await checker(current_user=manager_user)
    assert res["role"] == "MANAGER"


@pytest.mark.anyio
async def test_require_role_rbac_blocks_fde_for_manager_only_action():
    fde_user = DEMO_USERS["fde@calmwork.ai"]
    checker = require_role(["MANAGER"])
    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=fde_user)
    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail
