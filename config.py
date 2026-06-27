"""
config.py — Application configuration via pydantic-settings.
Reads values from .env automatically.
"""
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # OpenRouter
    openrouter_api_key: str = Field(default="", description="OpenRouter API key")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1")
    default_model: str = Field(default="qwen/qwen3-coder:free")
    fallback_model: str = Field(default="mistralai/mistral-7b-instruct:free")
    enable_reasoning: bool = Field(default=True)

    # Application
    app_name: str = Field(default="OmniClient AI")
    app_port: int = Field(default=8000)
    debug: bool = Field(default=True)

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
    database_url: str = Field(default="sqlite:///./omniclient.db")

    # Memory
    max_memory_entries: int = Field(default=50)
    memory_summary_threshold: int = Field(default=10)

    # Search
    enable_deep_search: bool = Field(default=True)
    max_search_results: int = Field(default=5)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
