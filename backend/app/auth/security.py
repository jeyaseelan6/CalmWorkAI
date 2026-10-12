"""
Authentication & JWT Security Module.
Provides token generation, verification, and role-based credential management.
"""

import jwt
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import hashlib
import logging
from app.config import settings

logger = logging.getLogger(__name__)

SECRET_KEY = getattr(settings, "SECRET_KEY", "calmwork-super-secret-development-jwt-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Pre-seeded authenticated system accounts
DEMO_USERS: Dict[str, Dict[str, Any]] = {
    "fde@calmwork.ai": {
        "id": "usr-fde-001",
        "email": "fde@calmwork.ai",
        "name": "Sarah Chen",
        "role": "FDE",
        "title": "Forward-Deployed Engineer",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest()
    },
    "manager@calmwork.ai": {
        "id": "usr-mgr-002",
        "email": "manager@calmwork.ai",
        "name": "David Miller",
        "role": "MANAGER",
        "title": "Engineering Manager",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest()
    }
}


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify plain password against hashed SHA-256 password."""
    return hashlib.sha256(plain_password.encode()).hexdigest() == password_hash


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token signature expired.")
        return None
    except jwt.InvalidTokenError:
        logger.warning("Invalid JWT token provided.")
        return None
