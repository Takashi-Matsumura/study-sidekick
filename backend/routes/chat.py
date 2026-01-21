"""RAG-enabled chat API routes."""

import logging
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import ChatRequest, Message
from vectordb import vector_db
from embeddings import embedding_model
from llm import llm_client, create_rag_prompt
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/completions")
async def chat_with_rag(request: ChatRequest):
    """
    Chat endpoint with RAG support.

    This endpoint:
    1. Takes the user's latest message
    2. If RAG is enabled, retrieves relevant context from vector database
    3. Constructs a prompt with context
    4. Calls llama.cpp for completion
    5. Streams the response back to the client
    """
    try:
        logger.info(f"Chat request (RAG: {request.use_rag})")

        # Get the latest user message
        user_messages = [msg for msg in request.messages if msg.role == "user"]
        if not user_messages:
            raise HTTPException(
                status_code=400,
                detail="No user message found"
            )

        latest_message = user_messages[-1].content
        logger.info(f"  User: {latest_message[:50]}...")

        # Prepare messages for LLM
        messages = list(request.messages)

        # If RAG is enabled, retrieve context and modify the latest message
        if request.use_rag:
            doc_count = vector_db.count()

            if doc_count > 0:
                logger.info("Retrieving RAG context...")

                # Get top_k from request or use default
                top_k = request.top_k or settings.rag_top_k

                # Generate query embedding
                query_embedding = embedding_model.encode_query(latest_message)

                # Build where filter for category if specified
                where_filter = None
                if request.category:
                    where_filter = {"category": request.category}
                    logger.info(f"  Filtering by category: {request.category}")

                # Query vector database
                results = vector_db.query(
                    query_embeddings=[query_embedding],
                    n_results=top_k,
                    where=where_filter,
                )

                # Build context items
                context_items = []
                threshold = settings.rag_similarity_threshold

                for i in range(len(results["ids"][0])):
                    document = results["documents"][0][i]
                    metadata = results["metadatas"][0][i]
                    distance = results["distances"][0][i]

                    # Convert distance to similarity
                    similarity = 1 - (distance ** 2 / 2)

                    if similarity >= threshold:
                        context_items.append({
                            "content": document,
                            "metadata": metadata,
                            "score": similarity,
                        })

                if context_items:
                    logger.info(f"  Retrieved {len(context_items)} context items")

                    # Create RAG prompt
                    rag_prompt = create_rag_prompt(context_items, latest_message)

                    # Replace the latest user message with RAG prompt
                    messages[-1] = Message(role="user", content=rag_prompt)
                else:
                    logger.info("  No relevant context found (below threshold)")
            else:
                logger.info("  No documents in collection, skipping RAG")

        # Stream response from LLM
        async def generate():
            try:
                async for chunk in llm_client.chat_completion(
                    messages=messages,
                    stream=request.stream,
                ):
                    # Format as SSE (Server-Sent Events)
                    yield f"data: {chunk}\n\n"

                # Send done signal
                yield "data: [DONE]\n\n"

            except Exception as e:
                logger.error(f"Error in streaming: {e}")
                error_data = json.dumps({"error": str(e)})
                yield f"data: {error_data}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat request failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Chat request failed: {str(e)}"
        )
