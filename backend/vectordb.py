"""ChromaDB vector database management."""

import logging
import os
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings

from config import settings

logger = logging.getLogger(__name__)


class VectorDB:
    """ChromaDB vector database wrapper."""

    def __init__(self):
        """Initialize ChromaDB client."""
        self.client = None
        self.collection = None
        self._initialize()

    def _initialize(self):
        """Initialize ChromaDB client and collection."""
        try:
            # Create persist directory if it doesn't exist
            persist_dir = os.path.abspath(settings.chroma_persist_dir)
            os.makedirs(persist_dir, exist_ok=True)

            logger.info(f"Initializing ChromaDB at: {persist_dir}")

            # Initialize ChromaDB client
            self.client = chromadb.PersistentClient(
                path=persist_dir,
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True,
                ),
            )

            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name=settings.chroma_collection_name,
                metadata={"description": "HR Evaluation documents collection"},
            )

            logger.info(f"ChromaDB initialized: collection '{settings.chroma_collection_name}'")

        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            raise

    def add_documents(
        self,
        ids: List[str],
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        """
        Add documents to the collection.

        Args:
            ids: List of unique document IDs
            documents: List of document texts
            embeddings: List of embedding vectors
            metadatas: Optional list of metadata dictionaries
        """
        try:
            self.collection.add(
                ids=ids,
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
            )
            logger.info(f"Added {len(ids)} documents to collection")

        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            raise

    def query(
        self,
        query_embeddings: List[List[float]],
        n_results: int = 3,
        where: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Query the collection for similar documents.

        Args:
            query_embeddings: Query embedding vectors
            n_results: Number of results to return
            where: Optional metadata filter

        Returns:
            Query results with ids, documents, metadatas, and distances
        """
        try:
            results = self.collection.query(
                query_embeddings=query_embeddings,
                n_results=n_results,
                where=where,
            )
            logger.info(f"Query returned {len(results['ids'][0])} results")
            return results

        except Exception as e:
            logger.error(f"Failed to query collection: {e}")
            raise

    def get_all_documents(self, where: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get all documents from the collection.

        Args:
            where: Optional metadata filter (e.g., {"category": "evaluation"})

        Returns:
            All documents with their metadata
        """
        try:
            results = self.collection.get(where=where)
            logger.info(f"Retrieved {len(results['ids'])} documents")
            return results

        except Exception as e:
            logger.error(f"Failed to get documents: {e}")
            raise

    def delete_documents(self, ids: List[str]) -> None:
        """
        Delete documents from the collection.

        Args:
            ids: List of document IDs to delete
        """
        try:
            self.collection.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} documents from collection")

        except Exception as e:
            logger.error(f"Failed to delete documents: {e}")
            raise

    def delete_by_filename(self, filename: str) -> int:
        """
        Delete all documents associated with a filename.

        Args:
            filename: Filename to delete

        Returns:
            Number of documents deleted
        """
        try:
            # Get all documents with this filename
            results = self.collection.get(
                where={"filename": filename}
            )

            if results['ids']:
                self.collection.delete(ids=results['ids'])
                count = len(results['ids'])
                logger.info(f"Deleted {count} chunks for file: {filename}")
                return count
            else:
                logger.info(f"No documents found for file: {filename}")
                return 0

        except Exception as e:
            logger.error(f"Failed to delete by filename: {e}")
            raise

    def count(self) -> int:
        """
        Count total documents in the collection.

        Returns:
            Number of documents
        """
        try:
            return self.collection.count()
        except Exception as e:
            logger.error(f"Failed to count documents: {e}")
            raise

    def reset(self) -> None:
        """Reset the collection (delete all documents)."""
        try:
            self.client.delete_collection(name=settings.chroma_collection_name)
            self.collection = self.client.create_collection(
                name=settings.chroma_collection_name,
                metadata={"description": "HR Evaluation documents collection"},
            )
            logger.info(f"Reset collection: '{settings.chroma_collection_name}'")

        except Exception as e:
            logger.error(f"Failed to reset collection: {e}")
            raise


# Global VectorDB instance
vector_db = VectorDB()
