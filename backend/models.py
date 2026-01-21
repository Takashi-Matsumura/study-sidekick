"""Pydantic models for API requests and responses."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# Chat Models
class Message(BaseModel):
    """Chat message."""
    role: str = Field(..., description="Role: user, assistant, or system")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Chat request with RAG support."""
    messages: List[Message] = Field(..., description="Conversation history")
    use_rag: bool = Field(default=True, description="Enable RAG context retrieval")
    top_k: Optional[int] = Field(default=None, description="Number of context chunks to retrieve")
    stream: bool = Field(default=True, description="Enable streaming response")
    category: Optional[str] = Field(default=None, description="RAG category filter (e.g., 'evaluation', 'goalsetting')")


# Document Models
class DocumentMetadata(BaseModel):
    """Document metadata."""
    filename: str
    file_type: str
    chunk_index: int
    total_chunks: int
    upload_timestamp: str


class Document(BaseModel):
    """Document for vector database."""
    id: str = Field(..., description="Unique document ID")
    content: str = Field(..., description="Document content")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")


class DocumentUploadResponse(BaseModel):
    """Response for document upload."""
    success: bool
    message: str
    document_count: int
    chunk_count: int


class DocumentListResponse(BaseModel):
    """Response for document list."""
    documents: List[Dict[str, Any]]
    total_count: int


# RAG Models
class RAGQueryRequest(BaseModel):
    """RAG query request."""
    query: str = Field(..., description="Query text")
    top_k: Optional[int] = Field(default=3, description="Number of results to retrieve")
    threshold: Optional[float] = Field(default=0.5, description="Similarity threshold")


class ContextItem(BaseModel):
    """Context item from RAG search."""
    content: str
    metadata: Dict[str, Any]
    score: float


class RAGQueryResponse(BaseModel):
    """RAG query response."""
    context: List[ContextItem]
    query: str
    retrieved_count: int


# Health Check
class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    chroma_status: str
    embedding_model: str
