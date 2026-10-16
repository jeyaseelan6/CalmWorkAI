"""
Knowledge & Documents Endpoints (/api/v1/engagements/{engagement_id}/documents).
Manages document ingestion, file uploads, binary file streaming, and Grounded RAG Q&A.
Uses synchronous route definitions so FastAPI dispatches blocking DB I/O to threadpools.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
import logging
from datetime import datetime

from app.db.database import get_db
from app.models import Engagement, TimelineEvent, DocumentModel, DocumentCategory, DocumentStatus
from app.services import extract_text_from_file, text_to_pdf_bytes
from app.api.deps import know_agent, storage_service
from app.api.schemas import IngestDocumentRequest, KnowledgeQueryRequest
from app.auth import require_role

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Knowledge"])


@router.get("/engagements/{engagement_id}/documents")
def list_documents(engagement_id: str, db: Session = Depends(get_db)):
    """List all documents uploaded to an engagement knowledge base."""
    docs = db.query(DocumentModel).filter(DocumentModel.engagement_id == engagement_id).order_by(DocumentModel.created_at.desc()).all()
    res = []
    for d in docs:
        url_lower = (d.file_url or "").lower()
        t_lower = d.title.lower()
        file_tuple = storage_service.get_document_file(engagement_id, d.id, file_url=d.file_url)
        fname = file_tuple[2].lower() if file_tuple else ""

        if fname.endswith(".pdf") or t_lower.endswith(".pdf") or ".pdf" in url_lower:
            ftype = "pdf"
        elif any(fname.endswith(ext) or t_lower.endswith(ext) or ext in url_lower for ext in [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"]):
            ftype = "image"
        else:
            ftype = "text"

        res.append({
            "id": d.id,
            "engagement_id": d.engagement_id,
            "title": d.title,
            "category": d.category.value if hasattr(d.category, "value") else str(d.category),
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "chunks_count": d.chunks_count,
            "file_type": ftype,
            "file_url": d.file_url,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at.isoformat() if d.created_at else None
        })
    return {
        "success": True,
        "data": res
    }


@router.post("/engagements/{engagement_id}/documents/upload")
def upload_document(
    engagement_id: str,
    payload: IngestDocumentRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER", "FDE"]))
):
    """Categorizes and indexes raw text document into KNOW Agent (Manager & FDE authorized)."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    result = know_agent.ingest_document(
        engagement_id=engagement_id,
        title=payload.title,
        raw_text=payload.content
    )

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")
    actor_id = current_user.get("id", "usr-fde-001" if user_role == "FDE" else "usr-mgr-002")

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    storage_uri = storage_service.upload_document(
        engagement_id=engagement_id,
        document_id=doc_id,
        filename=f"{payload.title}.txt",
        content=payload.content
    )
    category_enum = DocumentCategory.OTHER
    try:
        category_enum = DocumentCategory(payload.category)
    except Exception:
        category_enum = DocumentCategory.OTHER

    doc = DocumentModel(
        id=doc_id,
        engagement_id=engagement_id,
        title=payload.title,
        category=category_enum,
        status=DocumentStatus.INDEXED,
        content=payload.content,
        file_url=storage_uri,
        chunks_count=result.get("chunks_created", 1),
        uploaded_by=actor_name,
        created_at=datetime.utcnow()
    )
    db.add(doc)

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="DOCUMENT_INGESTED",
        title="Document Uploaded & Indexed",
        description=f"{user_role.capitalize()} {actor_name} uploaded document '{payload.title}' categorized as '{category_enum.value}'.",
        actor_type=user_role,
        actor_id=actor_id,
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": {
            "id": doc.id,
            "title": doc.title,
            "category": doc.category,
            "status": doc.status,
            "chunks_count": doc.chunks_count
        },
        "message": f"Document '{payload.title}' uploaded and indexed under category '{category_enum.value}'."
    }


@router.post("/engagements/{engagement_id}/documents/upload-file")
async def upload_document_file(
    engagement_id: str,
    file: UploadFile = File(...),
    category: str = Form("Technical Documentation"),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER", "FDE"]))
):
    """
    Multipart File Upload endpoint for Grounded RAG Knowledge Base.
    Extracts text, anonymizes via Privacy Guardrail, chunks and indexes into vector store.
    Authorized for both Manager and FDE.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        extracted_text = extract_text_from_file(file.filename or "uploaded_file.txt", file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error extracting text from file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract text from file: {str(e)}")

    doc_title = title.strip() if title and title.strip() else (file.filename or "Untitled Document")

    result = know_agent.ingest_document(
        engagement_id=engagement_id,
        title=doc_title,
        raw_text=extracted_text
    )

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")
    actor_id = current_user.get("id", "usr-fde-001" if user_role == "FDE" else "usr-mgr-002")

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    upload_filename = file.filename or f"{doc_title}.txt"
    storage_uri = storage_service.upload_binary_file(
        engagement_id=engagement_id,
        document_id=doc_id,
        filename=upload_filename,
        file_bytes=file_bytes,
        content_type=file.content_type or "application/octet-stream"
    )

    category_enum = DocumentCategory.OTHER
    for cat in DocumentCategory:
        if cat.value.lower() == category.lower() or cat.name.lower() == category.lower():
            category_enum = cat
            break

    chunks_count = result.get("chunks_created", 1)

    doc = DocumentModel(
        id=doc_id,
        engagement_id=engagement_id,
        title=doc_title,
        category=category_enum,
        status=DocumentStatus.INDEXED,
        content=extracted_text,
        file_url=storage_uri,
        chunks_count=chunks_count,
        uploaded_by=actor_name,
        created_at=datetime.utcnow()
    )
    db.add(doc)

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="DOCUMENT_INGESTED",
        title="Document Uploaded & Indexed",
        description=f"{user_role.capitalize()} {actor_name} uploaded '{doc_title}' ({category_enum.value}) — indexed into {chunks_count} vector chunks for Grounded RAG.",
        actor_type=user_role,
        actor_id=actor_id,
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": {
            "id": doc.id,
            "engagement_id": doc.engagement_id,
            "title": doc.title,
            "category": doc.category.value if hasattr(doc.category, "value") else str(doc.category),
            "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
            "chunks_count": doc.chunks_count,
            "storage_uri": storage_uri,
            "file_url": storage_uri,
            "created_at": doc.created_at.isoformat()
        },
        "message": f"Document '{doc_title}' uploaded and indexed into {chunks_count} vector chunks."
    }


@router.post("/engagements/{engagement_id}/knowledge/query")
def query_knowledge(engagement_id: str, payload: KnowledgeQueryRequest):
    """Answers user question strictly grounded on engagement documentation using Google ADK."""
    try:
        grounded_answer = know_agent.answer_question(
            engagement_id=engagement_id,
            raw_question=payload.question,
            top_k=payload.top_k
        )
        return {
            "success": True,
            "data": grounded_answer.model_dump(),
            "message": "Grounded Q&A response generated with source citations."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying knowledge: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
        )


@router.get("/engagements/{engagement_id}/documents-search")
def search_documents(
    engagement_id: str,
    q: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Search customer documents by title, content, or category without requiring AI inference."""
    query = db.query(DocumentModel).filter(DocumentModel.engagement_id == engagement_id)
    if category and category.strip() and category.strip().lower() != "all":
        query = query.filter(DocumentModel.category == category.strip())

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            (DocumentModel.title.ilike(term)) | (DocumentModel.content.ilike(term))
        )

    docs = query.order_by(DocumentModel.created_at.desc()).all()
    results = []
    for d in docs:
        t_lower = d.title.lower()
        file_tuple = storage_service.get_document_file(engagement_id, d.id)
        fname = file_tuple[2].lower() if file_tuple else t_lower
        if fname.endswith(".pdf") or t_lower.endswith(".pdf"):
            ftype = "pdf"
        elif any(fname.endswith(ext) or t_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"]):
            ftype = "image"
        else:
            ftype = "text"

        snippet = None
        if q and q.strip() and d.content:
            idx = d.content.lower().find(q.strip().lower())
            if idx != -1:
                start = max(0, idx - 60)
                end = min(len(d.content), idx + 140)
                snippet = ("..." if start > 0 else "") + d.content[start:end].strip() + ("..." if end < len(d.content) else "")

        results.append({
            "id": d.id,
            "engagement_id": d.engagement_id,
            "title": d.title,
            "category": d.category.value if hasattr(d.category, "value") else str(d.category),
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "chunks_count": d.chunks_count,
            "file_type": ftype,
            "snippet": snippet,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at.isoformat() if d.created_at else None
        })

    return {
        "success": True,
        "data": results,
        "total": len(results)
    }


@router.get("/engagements/{engagement_id}/documents/{doc_id}")
def get_document_detail(engagement_id: str, doc_id: str, db: Session = Depends(get_db)):
    """Retrieve single document details including full text and file type."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id, DocumentModel.engagement_id == engagement_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    t_lower = doc.title.lower()
    file_tuple = storage_service.get_document_file(engagement_id, doc_id)
    filename = file_tuple[2] if file_tuple else f"{doc.title}.txt"
    f_lower = filename.lower()

    if f_lower.endswith(".pdf") or t_lower.endswith(".pdf"):
        file_type = "pdf"
    elif any(f_lower.endswith(ext) or t_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"]):
        file_type = "image"
    else:
        file_type = "text"

    return {
        "success": True,
        "data": {
            "id": doc.id,
            "engagement_id": doc.engagement_id,
            "title": doc.title,
            "filename": filename,
            "category": doc.category.value if hasattr(doc.category, "value") else str(doc.category),
            "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
            "chunks_count": doc.chunks_count,
            "file_type": file_type,
            "file_url": doc.file_url,
            "has_binary_file": bool(doc.file_url or file_tuple),
            "content": doc.content,
            "uploaded_by": doc.uploaded_by,
            "created_at": doc.created_at.isoformat() if doc.created_at else None
        }
    }


@router.get("/engagements/{engagement_id}/documents/{doc_id}/file")
def stream_document_file(engagement_id: str, doc_id: str, db: Session = Depends(get_db)):
    """Streams the raw PDF or image file for in-browser reading/viewing."""
    from fastapi.responses import RedirectResponse

    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id, DocumentModel.engagement_id == engagement_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # If document has a Cloudinary CDN URL, redirect client directly to Cloudinary CDN
    if doc.file_url and (doc.file_url.startswith("http://") or doc.file_url.startswith("https://")):
        return RedirectResponse(url=doc.file_url, status_code=307)

    file_tuple = storage_service.get_document_file(engagement_id, doc_id, file_url=doc.file_url)
    if file_tuple:
        content_bytes, mime_type, filename = file_tuple
        is_pdf = (
            filename.lower().endswith(".pdf")
            or mime_type == "application/pdf"
            or doc.title.lower().endswith(".pdf")
        )
        if is_pdf:
            if not content_bytes.startswith(b"%PDF-"):
                text_content = content_bytes.decode("utf-8", "ignore")
                content_bytes = text_to_pdf_bytes(doc.title or filename, text_content)
            mime_type = "application/pdf"
            if not filename.lower().endswith(".pdf"):
                filename = f"{filename}.pdf"

        return Response(
            content=content_bytes,
            media_type=mime_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "public, max-age=3600"
            }
        )

    # Fallback: If no file on disk, check if it's meant to be a PDF
    if doc.title.lower().endswith(".pdf") or "pdf" in (doc.title.lower()):
        text_content = doc.content or f"{doc.title}\n\nDocument text content is not available."
        pdf_bytes = text_to_pdf_bytes(doc.title, text_content)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{doc.title}.pdf"',
                "Cache-Control": "public, max-age=3600"
            }
        )

    # Fallback: Serve text content directly
    text_content = doc.content or f"{doc.title}\n\nDocument text content is not available."
    return Response(
        content=text_content.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'inline; filename="{doc.title}.txt"'
        }
    )


@router.delete("/engagements/{engagement_id}/documents/{document_id}")
def delete_document(
    engagement_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER"]))
):
    """
    Manager-only endpoint: Permanently deletes a knowledge document.
    1. Removes binary file from Google Cloud Storage (GCS).
    2. Evicts semantic vector chunks from KNOW Agent in-memory index.
    3. Deletes DocumentModel from Cloud SQL / PostgreSQL.
    4. Records an audit TimelineEvent for governance provenance.
    """
    doc = db.query(DocumentModel).filter(
        DocumentModel.id == document_id,
        DocumentModel.engagement_id == engagement_id
    ).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found in engagement '{engagement_id}'."
        )

    doc_title = doc.title
    file_url = doc.file_url

    # 1. Permanently remove from Google Cloud Storage
    try:
        storage_service.delete_document_file(
            engagement_id=engagement_id,
            document_id=document_id,
            file_url=file_url
        )
    except Exception as e:
        logger.warning(f"Storage service deletion warning for {document_id}: {e}")

    # 2. Invalidate VectorStore memory for KNOW Agent
    try:
        know_agent.vector_store.delete_document_chunks(
            engagement_id=engagement_id,
            document_id=document_id,
            title=doc_title
        )
    except Exception as e:
        logger.warning(f"Vector store chunk removal warning for {document_id}: {e}")

    # 3. Delete Document record from database
    db.delete(doc)

    # 4. Audit Trail in Timeline
    mgr_name = current_user.get("name", "Manager")
    mgr_id = current_user.get("id", "usr-mgr")
    timeline_evt = TimelineEvent(
        id=f"evt-del-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="DOCUMENT_DELETED",
        title="Knowledge Resource Removed",
        description=f"Document '{doc_title}' permanently removed from GCS and Knowledge Base by Engineering Manager {mgr_name}.",
        actor_type="MANAGER",
        actor_id=mgr_id,
        created_at=datetime.utcnow()
    )
    db.add(timeline_evt)
    db.commit()

    logger.info(f"Document '{doc_title}' ({document_id}) deleted by Manager {mgr_name}")
    return {
        "success": True,
        "message": f"Document '{doc_title}' successfully removed from Google Cloud Storage and Knowledge Base.",
        "data": {
            "document_id": document_id,
            "title": doc_title,
            "deleted_by": mgr_name
        }
    }
