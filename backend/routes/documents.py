"""Document management API routes."""

import logging
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from models import DocumentUploadResponse, DocumentListResponse
from vectordb import vector_db
from embeddings import embedding_model
from text_processing import (
    extract_text_from_file,
    create_chunks_with_metadata,
    clean_text,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class TextUploadRequest(BaseModel):
    """Text upload request model."""
    text: str
    filename: str


class DocumentCreateRequest(BaseModel):
    """Simple document creation request."""
    content: str
    metadata: dict = {}


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload and process a document for RAG.

    Supports: .txt, .md, .json, .pdf
    """
    try:
        logger.info(f"Uploading document: {file.filename}")

        # Read file content
        content = await file.read()

        # Determine file type
        file_type = file.content_type or file.filename.split(".")[-1]

        # Extract text from file
        text = extract_text_from_file(content, file_type, file.filename)
        text = clean_text(text)

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="Failed to extract text from file or file is empty"
            )

        # Create chunks with metadata
        chunk_ids, chunks, metadatas = create_chunks_with_metadata(
            text=text,
            filename=file.filename,
            file_type=file_type,
        )

        # Generate embeddings for chunks
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        embeddings = embedding_model.encode_documents(chunks)

        # Add to vector database
        vector_db.add_documents(
            ids=chunk_ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        logger.info(
            f"Successfully uploaded {file.filename}: "
            f"{len(chunks)} chunks indexed"
        )

        return DocumentUploadResponse(
            success=True,
            message=f"Successfully uploaded {file.filename}",
            document_count=1,
            chunk_count=len(chunks),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.post("/upload-text", response_model=DocumentUploadResponse)
async def upload_text(request: TextUploadRequest):
    """
    Upload text directly to RAG.

    Args:
        request: Text and filename
    """
    try:
        logger.info(f"Uploading text as: {request.filename}")

        text = clean_text(request.text)

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="Text is empty"
            )

        # Add .md extension if not present
        filename = request.filename
        if not filename.endswith(('.md', '.txt')):
            filename = f"{filename}.md"

        # Create chunks with metadata
        chunk_ids, chunks, metadatas = create_chunks_with_metadata(
            text=text,
            filename=filename,
            file_type="markdown",
        )

        # Generate embeddings for chunks
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        embeddings = embedding_model.encode_documents(chunks)

        # Add to vector database
        vector_db.add_documents(
            ids=chunk_ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        logger.info(
            f"Successfully uploaded text as {filename}: "
            f"{len(chunks)} chunks indexed"
        )

        return DocumentUploadResponse(
            success=True,
            message=f"Text added to RAG: {filename}",
            document_count=1,
            chunk_count=len(chunks),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload text: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload text: {str(e)}"
        )


@router.get("/list", response_model=DocumentListResponse)
async def list_documents(category: str = None):
    """Get list of all uploaded documents, optionally filtered by category."""
    try:
        logger.info(f"Listing documents (category: {category})...")

        # Build where filter for category if specified
        where_filter = None
        if category:
            where_filter = {"category": category}

        # Get all documents from vector database
        results = vector_db.get_all_documents(where=where_filter)

        # Group chunks by filename
        documents_map = {}
        for i, doc_id in enumerate(results["ids"]):
            metadata = results["metadatas"][i]
            filename = metadata.get("filename", "unknown")

            if filename not in documents_map:
                documents_map[filename] = {
                    "filename": filename,
                    "file_type": metadata.get("file_type", "unknown"),
                    "chunk_count": 0,
                    "upload_timestamp": metadata.get("upload_timestamp", ""),
                    "total_chars": 0,
                }

            documents_map[filename]["chunk_count"] += 1
            documents_map[filename]["total_chars"] += metadata.get("char_count", 0)

        documents = list(documents_map.values())

        logger.info(f"Found {len(documents)} unique documents")

        return DocumentListResponse(
            documents=documents,
            total_count=len(documents),
        )

    except Exception as e:
        logger.error(f"Failed to list documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list documents: {str(e)}"
        )


@router.get("/content/{filename}")
async def get_document_content(filename: str):
    """Get document content by filename."""
    try:
        logger.info(f"Getting content for: {filename}")

        # Get all documents from vector database
        results = vector_db.get_all_documents()

        # Filter chunks that match the filename
        chunks = []
        original_content = None
        for i, doc_id in enumerate(results["ids"]):
            metadata = results["metadatas"][i]
            if metadata.get("filename") == filename:
                chunks.append({
                    "chunk_index": metadata.get("chunk_index", 0),
                    "content": results["documents"][i],
                    "char_count": metadata.get("char_count", 0),
                })
                # Get original content from first chunk's metadata
                if metadata.get("chunk_index", 0) == 0 and metadata.get("original_content"):
                    original_content = metadata.get("original_content")

        if not chunks:
            raise HTTPException(
                status_code=404,
                detail=f"Document not found: {filename}"
            )

        # Sort by chunk index
        chunks.sort(key=lambda x: x["chunk_index"])

        logger.info(f"Retrieved {len(chunks)} chunks for {filename}")

        response = {
            "filename": filename,
            "total_chunks": len(chunks),
            "chunks": chunks,
        }

        # Include original content if available (for editing)
        if original_content:
            response["original_content"] = original_content

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document content: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get document content: {str(e)}"
        )


@router.delete("/{filename}")
async def delete_document(filename: str):
    """Delete a document and all its chunks."""
    try:
        logger.info(f"Deleting document: {filename}")

        # Delete all chunks for this filename
        deleted_count = vector_db.delete_by_filename(filename)

        if deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"Document not found: {filename}"
            )

        logger.info(f"Deleted {filename}: {deleted_count} chunks removed")

        return {
            "success": True,
            "message": f"Successfully deleted {filename}",
            "chunks_deleted": deleted_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document: {str(e)}"
        )


@router.post("/reset")
async def reset_collection():
    """Reset the entire collection (delete all documents)."""
    try:
        logger.warning("Resetting collection...")

        vector_db.reset()

        logger.info("Collection reset successfully")

        return {
            "success": True,
            "message": "Collection reset successfully",
        }

    except Exception as e:
        logger.error(f"Failed to reset collection: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset collection: {str(e)}"
        )


@router.get("/count")
async def get_document_count():
    """Get total document count in the collection."""
    try:
        count = vector_db.count()
        return {
            "total_chunks": count,
        }

    except Exception as e:
        logger.error(f"Failed to count documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to count documents: {str(e)}"
        )


@router.post("")
async def create_document(request: DocumentCreateRequest):
    """
    Create a document from plain text content.

    Simple API for adding text to RAG knowledge base.
    """
    try:
        text = clean_text(request.content)

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="Content is empty"
            )

        title = request.metadata.get("title", "Untitled")
        category = request.metadata.get("category", "general")
        filename = f"{title}.md"

        # Create chunks with metadata
        chunk_ids, chunks, metadatas = create_chunks_with_metadata(
            text=text,
            filename=filename,
            file_type="markdown",
        )

        # Add category to metadata
        for m in metadatas:
            m["category"] = category
            m["title"] = title

        # Generate embeddings for chunks
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        embeddings = embedding_model.encode_documents(chunks)

        # Add to vector database
        vector_db.add_documents(
            ids=chunk_ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        logger.info(f"Created document '{title}': {len(chunks)} chunks")

        return {
            "success": True,
            "id": chunk_ids[0] if chunk_ids else None,
            "message": f"Document '{title}' created successfully",
            "chunk_count": len(chunks),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create document: {str(e)}"
        )


@router.get("")
async def get_documents():
    """
    Get all documents in simplified format.

    Returns individual chunks with their IDs for management.
    """
    try:
        results = vector_db.get_all_documents()

        documents = []
        for i, doc_id in enumerate(results["ids"]):
            metadata = results["metadatas"][i]
            documents.append({
                "id": doc_id,
                "content": results["documents"][i][:200] + "..." if len(results["documents"][i]) > 200 else results["documents"][i],
                "metadata": {
                    "title": metadata.get("title", metadata.get("filename", "Untitled")),
                    "category": metadata.get("category", ""),
                    "filename": metadata.get("filename", ""),
                },
                "created_at": metadata.get("upload_timestamp", ""),
            })

        return {
            "documents": documents,
            "total": len(documents),
        }

    except Exception as e:
        logger.error(f"Failed to get documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get documents: {str(e)}"
        )


@router.delete("/by-id/{doc_id}")
async def delete_document_by_id(doc_id: str):
    """Delete a single document chunk by its ID."""
    try:
        logger.info(f"Deleting document by ID: {doc_id}")

        # Delete the specific document
        vector_db.delete_documents([doc_id])

        logger.info(f"Deleted document: {doc_id}")

        return {
            "success": True,
            "message": f"Document deleted successfully",
        }

    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document: {str(e)}"
        )
