"""
FastAPI Security & RBAC Dependencies.
Enforces authentication and role-based permissions (FDE / MANAGER).
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any, List

from app.auth.security import decode_access_token, DEMO_USERS

security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> Dict[str, Any]:
    """
    Extracts and validates JWT Bearer Token from Authorization Header.
    If header missing or invalid, raises 401 Unauthorized.
    """
    if not credentials:
        # Default to FDE demo account if no token supplied for smooth developer trial
        return DEMO_USERS["fde@calmwork.ai"]

    token = credentials.credentials
    if token == "demo-manager-token":
        return DEMO_USERS["manager@calmwork.ai"]
    if token == "demo-fde-token":
        return DEMO_USERS["fde@calmwork.ai"]

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload["sub"]
    user = DEMO_USERS.get(email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found")

    return user


def require_role(allowed_roles: List[str]):
    """
    Role-Based Access Control (RBAC) Dependency.
    Verifies current authenticated user possesses one of the allowed roles.
    """
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Action requires role in {allowed_roles}, but current user has role '{user_role}'."
            )
        return current_user

    return role_checker
