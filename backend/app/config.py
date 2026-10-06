import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "CalmWork AI Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/calmwork_db"
    )
    
    # Google Cloud & AI Settings
    GCP_PROJECT_ID: Optional[str] = os.getenv("GCP_PROJECT_ID", "calmwork-ai-dev")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "us-central1")
    GCS_BUCKET_NAME: Optional[str] = os.getenv("GCS_BUCKET_NAME", "calmwork-documents")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # AI Input Privacy Guardrail Settings
    PRIVACY_GUARDRAIL_ENABLED: bool = True
    USE_CLOUD_DLP_API: bool = os.getenv("USE_CLOUD_DLP_API", "false").lower() == "true"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
