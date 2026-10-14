"""
Authentication Endpoints (/api/v1/auth).
Provides authoritative user authentication backed by PostgreSQL UserModel with demo fallback.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.db.database import get_db
from app.models.user import UserModel
from app.auth import (
    create_access_token,
    verify_password,
    DEMO_USERS,
    get_current_user
)
from app.api.schemas import LoginRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user credentials against PostgreSQL UserModel table.
    Falls back gracefully to demo accounts for offline/trial development.
    """
    email_clean = payload.email.strip().lower()

    # 1. Authoritative Database lookup
    try:
        db_user = db.query(UserModel).filter(UserModel.email == email_clean).first()
        if db_user:
            if not verify_password(payload.password, db_user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )
            token = create_access_token({"sub": db_user.email, "role": db_user.role})
            return {
                "success": True,
                "data": {
                    "access_token": token,
                    "token_type": "bearer",
                    "user": db_user.to_dict()
                },
                "message": f"Successfully authenticated as {db_user.name} ({db_user.role})"
            }
    except HTTPException:
        raise
    except Exception:
        pass  # Fall through to demo users if DB is unreachable

    # 2. Backward-compatible demo user fallback
    user = DEMO_USERS.get(email_clean)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    token = create_access_token({"sub": user["email"], "role": user["role"]})
    return {
        "success": True,
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "title": user["title"]
            }
        },
        "message": f"Successfully authenticated as {user['name']} ({user['role']})"
    }


@router.get("/me")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Return profile of currently authenticated user.
    """
    return {
        "success": True,
        "data": {
            "id": current_user["id"],
            "email": current_user["email"],
            "name": current_user["name"],
            "role": current_user["role"],
            "title": current_user.get("title", "")
        }
    }
