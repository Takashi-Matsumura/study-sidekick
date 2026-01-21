"""Configuration management for RAG backend."""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings."""

    # Backend
    backend_port: int = 8000
    backend_host: str = "0.0.0.0"

    # LLM (llama.cpp server)
    llm_base_url: str = "http://localhost:8080"

    # ChromaDB
    chroma_persist_dir: str = "../chroma_data"
    chroma_collection_name: str = "evaluation_documents"

    # Embeddings
    embedding_model: str = "intfloat/multilingual-e5-base"
    embedding_device: str = "cpu"

    # RAG
    rag_top_k: int = 3
    rag_similarity_threshold: float = 0.5
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # CORS
    cors_origins: str = "http://localhost:3000,https://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


# Global settings instance
settings = Settings()
