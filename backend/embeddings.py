"""Text embedding generation using Sentence Transformers."""

import logging
import time
from typing import List, Literal
from sentence_transformers import SentenceTransformer

from config import settings

logger = logging.getLogger(__name__)

# Model status type
ModelStatus = Literal["not_loaded", "downloading", "loading", "ready", "error"]


class EmbeddingModel:
    """Wrapper for Sentence Transformers embedding model."""

    def __init__(self):
        """Initialize the embedding model."""
        self.model = None
        self.embedding_dim = None
        self._is_loaded = False
        self._status: ModelStatus = "not_loaded"
        self._error_message: str | None = None
        self._load_start_time: float | None = None

    def _load_model(self):
        """Load the Sentence Transformers model."""
        if self._is_loaded:
            return

        try:
            logger.info(f"Loading embedding model: {settings.embedding_model}")
            self._status = "downloading"
            self._load_start_time = time.time()

            self.model = SentenceTransformer(
                settings.embedding_model,
                device=settings.embedding_device,
            )

            self._status = "loading"

            # Get embedding dimension
            self.embedding_dim = self.model.get_sentence_embedding_dimension()

            elapsed_time = time.time() - self._load_start_time
            logger.info(
                f"Embedding model loaded successfully "
                f"(dimension: {self.embedding_dim}, took {elapsed_time:.1f}s)"
            )

            self._is_loaded = True
            self._status = "ready"
            self._error_message = None
            self._load_start_time = None

        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self._status = "error"
            self._error_message = str(e)
            self._load_start_time = None
            raise

    def get_status(self) -> dict:
        """
        Get the current status of the embedding model.

        Returns:
            dict: Status information including state, error message, and elapsed time
        """
        elapsed_seconds = None
        if self._load_start_time is not None:
            elapsed_seconds = int(time.time() - self._load_start_time)

        return {
            "status": self._status,
            "is_ready": self._is_loaded,
            "model_name": settings.embedding_model,
            "error": self._error_message,
            "elapsed_seconds": elapsed_seconds,
        }

    def encode(self, texts: List[str], show_progress: bool = False) -> List[List[float]]:
        """
        Encode texts to embedding vectors.

        Args:
            texts: List of text strings to encode
            show_progress: Whether to show progress bar

        Returns:
            List of embedding vectors
        """
        # Lazy load model on first use
        if not self._is_loaded:
            self._load_model()

        try:
            logger.debug(f"Encoding {len(texts)} texts...")

            embeddings = self.model.encode(
                texts,
                convert_to_numpy=True,
                show_progress_bar=show_progress,
                normalize_embeddings=True,  # Normalize for cosine similarity
            )

            # Convert to list of lists
            embeddings_list = embeddings.tolist()

            logger.debug(f"Encoded {len(texts)} texts to embeddings")
            return embeddings_list

        except Exception as e:
            logger.error(f"Failed to encode texts: {e}")
            raise

    def encode_query(self, query: str) -> List[float]:
        """
        Encode a single query text.

        Args:
            query: Query text to encode

        Returns:
            Embedding vector
        """
        try:
            # For E5 models, add "query: " prefix for better retrieval
            if "e5" in settings.embedding_model.lower():
                query = f"query: {query}"

            embeddings = self.encode([query], show_progress=False)
            return embeddings[0]

        except Exception as e:
            logger.error(f"Failed to encode query: {e}")
            raise

    def encode_documents(self, documents: List[str]) -> List[List[float]]:
        """
        Encode documents for indexing.

        Args:
            documents: List of document texts

        Returns:
            List of embedding vectors
        """
        try:
            # For E5 models, add "passage: " prefix for documents
            if "e5" in settings.embedding_model.lower():
                documents = [f"passage: {doc}" for doc in documents]

            return self.encode(documents, show_progress=True)

        except Exception as e:
            logger.error(f"Failed to encode documents: {e}")
            raise


# Global embedding model instance
embedding_model = EmbeddingModel()
