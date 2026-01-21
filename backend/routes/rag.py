"""RAG (Retrieval-Augmented Generation) API routes."""

import logging
from fastapi import APIRouter, HTTPException

from models import RAGQueryRequest, RAGQueryResponse, ContextItem
from vectordb import vector_db
from embeddings import embedding_model
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/query", response_model=RAGQueryResponse)
async def query_rag(request: RAGQueryRequest):
    """
    Query the RAG system for relevant context.

    This endpoint:
    1. Converts the query to an embedding vector
    2. Searches the vector database for similar documents
    3. Filters results by similarity threshold
    4. Returns the most relevant context chunks
    """
    try:
        logger.info(f"RAG query: {request.query[:50]}...")

        # Use provided parameters or defaults from settings
        top_k = request.top_k or settings.rag_top_k
        threshold = request.threshold or settings.rag_similarity_threshold

        # Check if collection is empty
        doc_count = vector_db.count()
        if doc_count == 0:
            logger.warning("No documents in collection")
            return RAGQueryResponse(
                context=[],
                query=request.query,
                retrieved_count=0,
            )

        # Generate query embedding
        logger.debug("Generating query embedding...")
        query_embedding = embedding_model.encode_query(request.query)

        # Query vector database
        results = vector_db.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )

        # Process results
        context_items = []
        for i in range(len(results["ids"][0])):
            doc_id = results["ids"][0][i]
            document = results["documents"][0][i]
            metadata = results["metadatas"][0][i]
            distance = results["distances"][0][i]

            # Convert distance to similarity score (cosine similarity)
            # ChromaDB returns L2 distance for normalized vectors
            # similarity = 1 - (distance^2 / 2)
            similarity = 1 - (distance ** 2 / 2)

            # Filter by threshold
            if similarity >= threshold:
                context_items.append(
                    ContextItem(
                        content=document,
                        metadata=metadata,
                        score=round(similarity, 4),
                    )
                )
                logger.debug(
                    f"  {metadata.get('filename', 'unknown')} "
                    f"(chunk {metadata.get('chunk_index', '?')}) "
                    f"- score: {similarity:.4f}"
                )

        logger.info(
            f"Retrieved {len(context_items)} context items "
            f"(threshold: {threshold})"
        )

        return RAGQueryResponse(
            context=context_items,
            query=request.query,
            retrieved_count=len(context_items),
        )

    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"RAG query failed: {str(e)}"
        )


@router.get("/stats")
async def get_rag_stats():
    """Get RAG system statistics."""
    try:
        total_chunks = vector_db.count()

        # Get unique documents count
        results = vector_db.get_all_documents()
        unique_files = set()
        if results["metadatas"]:
            unique_files = {
                meta.get("filename", "unknown")
                for meta in results["metadatas"]
            }

        return {
            "total_chunks": total_chunks,
            "unique_documents": len(unique_files),
            "embedding_model": settings.embedding_model,
            "embedding_dimension": embedding_model.embedding_dim if embedding_model._is_loaded else None,
            "chunk_size": settings.chunk_size,
            "chunk_overlap": settings.chunk_overlap,
            "top_k": settings.rag_top_k,
            "similarity_threshold": settings.rag_similarity_threshold,
        }

    except Exception as e:
        logger.error(f"Failed to get RAG stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get RAG stats: {str(e)}"
        )
