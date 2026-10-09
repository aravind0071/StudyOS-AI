import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = (BACKEND_DIR / "studyos.db").as_posix()
IS_SERVERLESS = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("VERCEL_ENV"))


class Settings(BaseSettings):
    # App
    APP_NAME: str = "StudyOS AI"
    APP_VERSION: str = "1.0.0"
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # Database: SQLite for local dev, PostgreSQL in production via DATABASE_URL
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_PATH}"

    # Security
    SECRET_KEY: str = "studyos-ai-super-secret-key-32-chars-minimum-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "StudyOS AI <noreply@studyosai.com>"

    # AI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    GEMINI_API_KEY: str = ""

    # File Storage: write to /tmp on serverless environments where root filesystem is read-only
    UPLOAD_DIR: str = "/tmp/uploads" if IS_SERVERLESS else "./uploads"
    MAX_FILE_SIZE_MB: int = 50

    # OTP
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60

    # Development
    DEMO_MODE: bool = True

    class Config:
        env_file = str(BACKEND_DIR / ".env")
        case_sensitive = True
        extra = "ignore"


settings = Settings()
