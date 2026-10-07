"""Application settings, read from environment variables."""
import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./formwise.db")
        # Comma-separated list of allowed frontend origins ("*" allows all).
        self.cors_origins: list[str] = [
            o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
        ]
        # Seed demo data on startup when the database is empty.
        self.seed_on_startup: bool = os.getenv("SEED_ON_STARTUP", "true").lower() == "true"
        # Hugging Face Inference (OpenAI-compatible router). Optional.
        self.hf_token: str | None = os.getenv("HF_TOKEN") or None
        self.hf_model: str = os.getenv("HF_MODEL", "meta-llama/Llama-3.1-8B-Instruct")
        self.hf_base_url: str = os.getenv("HF_BASE_URL", "https://router.huggingface.co/v1")
        self.hf_timeout: float = float(os.getenv("HF_TIMEOUT", "40"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
