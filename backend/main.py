"""FastAPI backend for RAG-enabled HR evaluation chat."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from models import HealthResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    logger.info("Starting RAG backend server...")
    logger.info(f"ChromaDB persist dir: {settings.chroma_persist_dir}")
    logger.info(f"Embedding model: {settings.embedding_model}")
    logger.info(f"LLM URL: {settings.llm_base_url}")

    # Initialize services
    from vectordb import vector_db
    from embeddings import embedding_model

    logger.info(f"VectorDB initialized with {vector_db.count()} documents")
    logger.info("Embedding model ready (lazy loading enabled)")

    yield

    logger.info("Shutting down RAG backend server...")


# Create FastAPI app
app = FastAPI(
    title="HR Evaluation RAG Backend",
    description="RAG-enabled backend for HR evaluation assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "HR Evaluation RAG Backend",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    try:
        from vectordb import vector_db

        # Check ChromaDB connection
        doc_count = vector_db.count()
        chroma_status = f"connected ({doc_count} documents)"

        return HealthResponse(
            status="healthy",
            version="0.1.0",
            chroma_status=chroma_status,
            embedding_model=settings.embedding_model,
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
            },
        )


@app.get("/api/model-status")
async def model_status():
    """Get the current status of the embedding model."""
    try:
        from embeddings import embedding_model

        return embedding_model.get_status()
    except Exception as e:
        logger.error(f"Failed to get model status: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "is_ready": False,
                "error": str(e),
            },
        )


# Import and register routers
from routes import documents, rag, chat, admin_settings, llm

app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(admin_settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(llm.router, prefix="/api/llm", tags=["llm"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
        log_level="info",
    )
