from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "MediShelf AI"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    # DEBUG drives SQLAlchemy's echo flag, so leaving it on floods the console with
    # every query the seeder and request handlers run. Opt in via backend/.env.
    DEBUG: bool = False

    # Database: allow MEDISHELF_DATABASE_URL or sanitize system DATABASE_URL
    MEDISHELF_DATABASE_URL: Optional[str] = None
    DATABASE_URL: str = "sqlite:///./medishelf.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: Optional[str]) -> str:
        if not v or not isinstance(v, str):
            return "sqlite:///./medishelf.db"
        # If external env set Prisma-style 'file:...' convert to sqlite:///
        if v.startswith("file:"):
            file_path = v[len("file:"):].lstrip("/")
            return f"sqlite:///{file_path}"
        # Validate that it has a known dialect
        if "://" not in v:
            return "sqlite:///./medishelf.db"
        return v

    @property
    def effective_database_url(self) -> str:
        if self.MEDISHELF_DATABASE_URL:
            return self.MEDISHELF_DATABASE_URL
        return self.DATABASE_URL

    # CORS. The frontend talks to this API cross-origin via VITE_API_BASE_URL, so the
    # dev server origin must be allow-listed. 3000 = TanStack Start, 5173 = plain Vite,
    # 8080 = alternate dev port. Override with ALLOWED_ORIGINS in backend/.env.
    ALLOWED_ORIGINS: Union[str, List[str]] = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8080,http://127.0.0.1:8080"
    )

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, list):
            return self.ALLOWED_ORIGINS
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
