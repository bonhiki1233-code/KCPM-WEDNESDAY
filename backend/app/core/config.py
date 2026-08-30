import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Get absolute path to .env file (backend/.env)
    # config.py is in app/core/, so go up 3 levels to backend/
    ROOT_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ENV_PATH: str = os.path.join(ROOT_DIR, ".env")

    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        case_sensitive=True,
        extra="ignore"
    )
    
    # Project
    PROJECT_NAME: str = "CollabSphere API"
    API_V1_STR: str = "/api/v1"
    
    # Database - Can use Supabase PostgreSQL or local PostgreSQL
    # For Supabase, use format: postgresql://user:password@host:port/database
    DATABASE_URL: str = "postgresql://collabsphere:collabsphere_password@localhost:5432/collabsphere_db"
    
    # Supabase (optional)
    SUPABASE_URL: str = ""  # e.g., https://csvlvzkucubqlfnuuizk.supabase.co
    SUPABASE_KEY: str = ""  # Use anon key for client, service_role key for server
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS - can be set as comma-separated string in env
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # Google Gemini API
    GOOGLE_GEMINI_API_KEY: str = ""
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS_ORIGINS string to list."""
        origins = []
        for origin in self.CORS_ORIGINS.split(","):
            cleaned = origin.strip().strip('"').strip("'")
            if cleaned:
                origins.append(cleaned)
        return origins
    
    @property
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        """Alias for cors_origins_list for backward compatibility."""
        return self.cors_origins_list


# Create a single instance of Settings
settings = Settings()

