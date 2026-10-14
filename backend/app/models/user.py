from sqlalchemy import Column, String, DateTime
from datetime import datetime
from app.models.engagement import Base
import enum


class UserRole(str, enum.Enum):
    FDE = "FDE"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"


class UserModel(Base):
    """Authoritative User Entity for Authentication, RBAC and Tenant Ownership."""
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), default="FDE", nullable=False, index=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "title": self.title
        }
