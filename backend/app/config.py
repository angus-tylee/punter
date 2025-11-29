from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Supabase configuration
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    database_url: Optional[str] = None
    
    # LLM configuration
    openai_api_key: Optional[str] = None
    
    # Instagram configuration
    instagram_app_id: Optional[str] = None
    instagram_app_secret: Optional[str] = None
    instagram_access_token: Optional[str] = None
    instagram_webhook_verify_token: Optional[str] = None
    instagram_test_account_id: Optional[str] = None
    
    # API configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

