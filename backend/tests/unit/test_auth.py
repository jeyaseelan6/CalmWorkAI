"""
Unit test suite for Authentication & RBAC Authorization.
"""

from app.auth import create_access_token, decode_access_token, verify_password, DEMO_USERS


def test_password_hashing():
    fde = DEMO_USERS["fde@calmwork.ai"]
    assert verify_password("password123", fde["password_hash"]) is True
    assert verify_password("wrongpassword", fde["password_hash"]) is False
    print("Password hashing test passed!")


def test_jwt_token_generation_and_decoding():
    token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "manager@calmwork.ai"
    assert payload["role"] == "MANAGER"
    print("JWT token generation & decoding test passed!")


if __name__ == "__main__":
    test_password_hashing()
    test_jwt_token_generation_and_decoding()
