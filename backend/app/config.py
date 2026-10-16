import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

load_dotenv(override=True)


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
    SEED_DEFAULT_DATA: bool = os.getenv("SEED_DEFAULT_DATA", "false").lower() == "true"
    
    # Google Cloud & AI Settings (Primary Competition Platform)
    GCP_PROJECT_ID: Optional[str] = os.getenv("GCP_PROJECT_ID", "calmwork-ai")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "asia-south1")
    GCS_BUCKET_NAME: Optional[str] = os.getenv("GCS_BUCKET_NAME", "calmwork-documents-63094329383")
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    USE_VERTEX_AI: bool = os.getenv("USE_VERTEX_AI", "false").lower() == "true"
    
    # Groq AI Settings (Testing / Rapid Prototyping Adapter)
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    
    # Google ADK Architecture Settings
    ADK_APP_NAME: str = os.getenv("ADK_APP_NAME", "calmwork-ai")
    ADK_SESSION_STORAGE: str = os.getenv("ADK_SESSION_STORAGE", "memory")  # "memory" or "database"
    ENABLE_ADK_TRACING: bool = os.getenv("ENABLE_ADK_TRACING", "false").lower() == "true"
    
    # Auth & Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "calmwork-super-secret-development-jwt-key-2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # AI Input Privacy Guardrail Settings
    PRIVACY_GUARDRAIL_ENABLED: bool = True
    USE_CLOUD_DLP_API: bool = os.getenv("USE_CLOUD_DLP_API", "false").lower() == "true"
    
    # Cloudinary Cloud Storage Settings
    CLOUDINARY_CLOUD_NAME: Optional[str] = os.getenv("CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_API_KEY: Optional[str] = os.getenv("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET: Optional[str] = os.getenv("CLOUDINARY_API_SECRET")
    CLOUDINARY_URL: Optional[str] = os.getenv("CLOUDINARY_URL")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
