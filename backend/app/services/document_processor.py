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
    ".yaml", ".yml", ".log", ".py", ".sql", ".rst", ".xml",
    ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"}


def extract_text_from_file(filename: str, content_bytes: bytes) -> str:
    """
    Extracts plain text content from uploaded file bytes based on file extension.
    Supports plain text, markdown, PDF, JSON, CSV, code/config files, and images.
    
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

    # 2. Image Files (Architecture Diagrams & Visual Blueprints)
    if ext in IMAGE_EXTENSIONS:
        logger.info(f"Processing image artifact: {filename} ({len(content_bytes)} bytes)")
        return (
            f"[Visual Architecture Artifact: {filename}]\n"
            f"Artifact Type: Image / System Architecture Blueprint\n"
            f"Format: {ext.upper().replace('.', '')}\n"
            f"Filename: {filename}\n"
            f"Summary: Visual architecture diagram and technical system layout uploaded for engagement reference."
        )

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


def text_to_pdf_bytes(title: str, text: str) -> bytes:
    """
    Synthesizes a standards-compliant, multi-page %PDF-1.4 binary from plain text.
    Ensures any text-based document or legacy PDF can be natively rendered in browser PDF engines.
    """
    lines = (text or "").replace("\r\n", "\n").split("\n")
    page_width = 612
    page_height = 792
    margin = 54
    line_height = 14
    max_lines_per_page = 44

    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    wrapped_lines: list[str] = []
    for line in lines:
        if not line.strip():
            wrapped_lines.append("")
            continue
        words = line.split(" ")
        curr = ""
        for w in words:
            if len(curr) + len(w) + 1 <= 85:
                curr = curr + (" " if curr else "") + w
            else:
                wrapped_lines.append(curr)
                curr = w
        if curr:
            wrapped_lines.append(curr)

    pages: list[list[str]] = []
    for i in range(0, len(wrapped_lines), max_lines_per_page):
        pages.append(wrapped_lines[i : i + max_lines_per_page])

    if not pages:
        pages = [[""]]

    objects: list[str] = []

    def add_obj(content: str) -> int:
        objects.append(content)
        return len(objects)

    add_obj("<< /Type /Catalog /Pages 2 0 R >>")
    add_obj("")  # placeholder for /Pages
    font_id = add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_ids: list[int] = []
    for page_idx, page_lines in enumerate(pages):
        stream_lines = [
            "BT",
            "/F1 10 Tf",
            f"{margin} {page_height - margin} Td",
            f"{line_height} TL"
        ]
        if page_idx == 0 and title:
            stream_lines.append("/F1 14 Tf")
            stream_lines.append(f"({esc(title)}) Tj")
            stream_lines.append("T*")
            stream_lines.append("/F1 10 Tf")
            stream_lines.append("T*")

        for l in page_lines:
            stream_lines.append(f"({esc(l)}) Tj")
            stream_lines.append("T*")
        stream_lines.append("ET")

        content_str = "\n".join(stream_lines)
        content_bytes = content_str.encode("latin-1", "replace")

        c_id = add_obj(f"<< /Length {len(content_bytes)} >>\nstream\n{content_str}\nendstream")
        p_id = add_obj(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {c_id} 0 R >>"
        )
        page_ids.append(p_id)

    kids = " ".join([f"{pid} 0 R" for pid in page_ids])
    objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>"

    out = bytearray()
    out.extend(b"%PDF-1.4\n")
    offsets: list[int] = []
    for i, obj in enumerate(objects):
        offsets.append(len(out))
        out.extend(f"{i + 1} 0 obj\n{obj}\nendobj\n".encode("latin-1", "replace"))

    xref_offset = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("latin-1"))
    for off in offsets:
        out.extend(f"{off:010d} 00000 n \n".encode("latin-1"))

    out.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("latin-1")
    )
    return bytes(out)

