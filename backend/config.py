from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    secret_key: str
    jwt_secret: str
    cors_origins: list[str] = ["http://localhost:5173"]

    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    gcp_project_id: str
    gcp_location: str = "us-central1"
    gemini_model: str = "gemini-2.5-flash"

    gcs_bucket_name: str
    gcs_signed_url_expiry_minutes: int = 15

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
