"""Text processing utilities for document chunking and parsing."""

import logging
import hashlib
from typing import List, Dict, Any
from datetime import datetime
import re

from config import settings

logger = logging.getLogger(__name__)


def create_document_id(filename: str, chunk_index: int) -> str:
    """
    Create a unique document ID.

    Args:
        filename: Source filename
        chunk_index: Chunk index

    Returns:
        Unique document ID
    """
    content = f"{filename}_{chunk_index}_{datetime.now().isoformat()}"
    return hashlib.md5(content.encode()).hexdigest()


def split_text_into_chunks(
    text: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
) -> List[str]:
    """
    Split text into overlapping chunks.

    Args:
        text: Text to split
        chunk_size: Maximum chunk size in characters
        chunk_overlap: Overlap size in characters

    Returns:
        List of text chunks
    """
    if chunk_size is None:
        chunk_size = settings.chunk_size
    if chunk_overlap is None:
        chunk_overlap = settings.chunk_overlap

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        # If not the last chunk, try to break at sentence boundary
        if end < len(text):
            # Look for sentence endings in the last 20% of the chunk
            search_start = int(end - chunk_size * 0.2)
            sentence_end = max(
                text.rfind("。", search_start, end),
                text.rfind(".", search_start, end),
                text.rfind("!", search_start, end),
                text.rfind("?", search_start, end),
                text.rfind("\n", search_start, end),
            )

            if sentence_end > start:
                end = sentence_end + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # Move to next chunk with overlap
        start = end - chunk_overlap if end < len(text) else end

    logger.debug(f"Split text into {len(chunks)} chunks")
    return chunks


def extract_text_from_file(file_content: bytes, file_type: str, filename: str) -> str:
    """
    Extract text from file content based on file type.

    Args:
        file_content: File content as bytes
        file_type: File MIME type or extension
        filename: Original filename

    Returns:
        Extracted text
    """
    try:
        # Text files
        if file_type in ["text/plain", ".txt", ".md", ".markdown"]:
            return file_content.decode("utf-8", errors="ignore")

        # JSON files
        elif file_type in ["application/json", ".json"]:
            import json
            data = json.loads(file_content.decode("utf-8"))
            # Convert JSON to readable text
            return json.dumps(data, indent=2, ensure_ascii=False)

        # PDF files
        elif file_type in ["application/pdf", ".pdf"]:
            try:
                from pypdf import PdfReader
                from io import BytesIO

                pdf_file = BytesIO(file_content)
                reader = PdfReader(pdf_file)

                text_parts = []
                for page_num, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if text.strip():
                        text_parts.append(f"[Page {page_num + 1}]\n{text}")

                return "\n\n".join(text_parts)

            except Exception as e:
                logger.warning(f"Failed to extract PDF text: {e}")
                return ""

        else:
            logger.warning(f"Unsupported file type: {file_type}")
            return file_content.decode("utf-8", errors="ignore")

    except Exception as e:
        logger.error(f"Failed to extract text from file: {e}")
        raise


def create_chunks_with_metadata(
    text: str,
    filename: str,
    file_type: str,
) -> tuple[List[str], List[str], List[Dict[str, Any]]]:
    """
    Create chunks with metadata for vector database storage.

    Args:
        text: Document text
        filename: Source filename
        file_type: File type

    Returns:
        Tuple of (chunk_ids, chunks, metadatas)
    """
    chunks = split_text_into_chunks(text)
    timestamp = datetime.now().isoformat()

    chunk_ids = []
    metadatas = []

    for i, chunk in enumerate(chunks):
        chunk_id = create_document_id(filename, i)
        chunk_ids.append(chunk_id)

        metadata = {
            "filename": filename,
            "file_type": file_type,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "upload_timestamp": timestamp,
            "char_count": len(chunk),
        }

        # Store original content in first chunk's metadata for editing
        if i == 0:
            metadata["original_content"] = text

        metadatas.append(metadata)

    logger.info(
        f"Created {len(chunks)} chunks from {filename} "
        f"(total chars: {len(text)})"
    )

    return chunk_ids, chunks, metadatas


def clean_text(text: str) -> str:
    """
    Clean and normalize text while preserving line breaks.

    Args:
        text: Text to clean

    Returns:
        Cleaned text
    """
    # Remove multiple spaces (but not newlines)
    text = re.sub(r"[^\S\n]+", " ", text)

    # Remove multiple newlines (more than 2)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Clean up lines: strip trailing spaces from each line
    lines = text.split("\n")
    lines = [line.strip() for line in lines]
    text = "\n".join(lines)

    # Strip leading/trailing whitespace
    text = text.strip()

    return text
