"""
config.py â€” Application configuration via pydantic-settings.
Reads values from .env automatically.
"""
import os
from dotenv import load_dotenv, find_dotenv
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from functools import lru_cache

# Load environment variables from .env when available, and let the file override stale process values.
dotenv_path = find_dotenv(usecwd=True)
if dotenv_path:
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)


class Settings(BaseSettings):
    # OpenRouter
    openrouter_api_key: str = Field(default_factory=lambda: os.getenv("OPENROUTER_API_KEY", ""), description="OpenRouter API key")
    openrouter_base_url: str = Field(default_factory=lambda: os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"))
    default_model: str = Field(default_factory=lambda: os.getenv("DEFAULT_MODEL", "cohere/north-mini-code:free"))
    fallback_model: str = Field(default_factory=lambda: os.getenv("FALLBACK_MODEL", "qwen/qwen3-coder:free"))
    enable_reasoning: bool = Field(default_factory=lambda: os.getenv("ENABLE_REASONING", "true").lower() in ("true", "1", "yes"))
    temperature: float = Field(default_factory=lambda: float(os.getenv("TEMPERATURE", "0.7")))
    max_tokens: int = Field(default_factory=lambda: int(os.getenv("MAX_TOKENS", "4096")))
    # E2B Sandbox
    e2b_api_key: str = Field(default_factory=lambda: os.getenv("E2B_API_KEY", ""), description="E2B API key")
    e2b_template_id: str = Field(default_factory=lambda: os.getenv("E2B_TEMPLATE_ID", ""), description="Optional E2B sandbox template ID")

    # Google OAuth (Gmail Integration)
    google_client_id: str = Field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", ""), description="Google OAuth Client ID")
    google_client_secret: str = Field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_SECRET", ""), description="Google OAuth Client Secret")
    google_redirect_uri: str = Field(default_factory=lambda: os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8001/api/integrations/gmail/callback"), description="Google OAuth Redirect URI")

    # Stripe Payment Integration
    stripe_api_key: str = Field(default_factory=lambda: os.getenv("STRIPE_API_KEY", ""), description="Stripe API Secret Key")
    stripe_webhook_secret: str = Field(default_factory=lambda: os.getenv("STRIPE_WEBHOOK_SECRET", ""), description="Stripe Webhook Signing Secret")
    stripe_price_id_pro: str = Field(default_factory=lambda: os.getenv("STRIPE_PRICE_ID_PRO", ""), description="Stripe Price ID for Pro Plan")
    stripe_price_id_enterprise: str = Field(default_factory=lambda: os.getenv("STRIPE_PRICE_ID_ENTERPRISE", ""), description="Stripe Price ID for Enterprise Plan")
    free_tier_message_limit: int = Field(default_factory=lambda: int(os.getenv("FREE_TIER_MESSAGE_LIMIT", "20")))



    # Application
    app_name: str = Field(default_factory=lambda: os.getenv("APP_NAME", "OmniClient AI"))
    app_port: int = Field(default_factory=lambda: int(os.getenv("APP_PORT", "8001")))
    debug: bool = Field(default_factory=lambda: os.getenv("DEBUG", "true").lower() in ("true", "1", "yes"))

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "development"}:
                return True
        return value

    # Database
    database_url: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./omniclient.db"))

    # Memory
    max_memory_entries: int = Field(default_factory=lambda: int(os.getenv("MAX_MEMORY_ENTRIES", "50")))
    memory_summary_threshold: int = Field(default_factory=lambda: int(os.getenv("MEMORY_SUMMARY_THRESHOLD", "10")))

    # Search
    enable_deep_search: bool = Field(default_factory=lambda: os.getenv("ENABLE_DEEP_SEARCH", "true").lower() in ("true", "1", "yes"))
    max_search_results: int = Field(default_factory=lambda: int(os.getenv("MAX_SEARCH_RESULTS", "5")))

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()





