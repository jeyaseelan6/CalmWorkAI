"""
Document Processor Service for CalmWork AI.
Extracts clean, normalized text from various file formats (.txt, .md, .pdf, .json, .csv, etc.)
for ingestion into the KNOW Agent's Grounded RAG index.
"""

import io
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {
    ".txt", ".md", ".markdown", ".pdf", ".json", ".csv",
    ".yaml", ".yml", ".log", ".py", ".sql", ".rst", ".xml"
}


def extract_text_from_file(filename: str, content_bytes: bytes) -> str:
    """
    Extracts plain text content from uploaded file bytes based on file extension.
    Supports plain text, markdown, PDF, JSON, CSV, and code/config files.
    
    Raises:
        ValueError: If file is empty, format is unsupported, or text cannot be extracted.
    """
    if not content_bytes or len(content_bytes) == 0:
        raise ValueError(f"Uploaded file '{filename}' is empty.")

    ext = os.path.splitext(filename)[1].lower()
    if not ext:
        ext = ".txt"

    # 1. PDF Extraction
    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    pages_text.append(text.strip())
            
            full_text = "\n\n".join(pages_text).strip()
            if not full_text:
                raise ValueError(
                    f"PDF '{filename}' contains no extractable text. "
                    "Scanned image PDFs without OCR are not supported."
                )
            logger.info(f"Successfully extracted {len(full_text)} characters from {len(reader.pages)} PDF pages: {filename}")
            return full_text
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            logger.error(f"Error parsing PDF '{filename}': {str(e)}")
            raise ValueError(f"Failed to process PDF '{filename}': {str(e)}")

    # 2. Text / Markdown / JSON / CSV / Code Extraction
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    extracted = None
    for enc in encodings:
        try:
            extracted = content_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    if extracted is None:
        raise ValueError(f"Unable to decode text from '{filename}'. Please ensure it is a valid text or PDF file.")

    cleaned_text = extracted.strip()
    if not cleaned_text:
        raise ValueError(f"File '{filename}' contains no readable text content.")

    logger.info(f"Successfully extracted {len(cleaned_text)} characters from text file: {filename}")
    return cleaned_text
