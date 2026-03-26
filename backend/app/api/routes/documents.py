"""
Documents CRUD routes.

Endpoints
---------
GET    /documents/                  List + filter documents
POST   /documents/upload            Upload a file and create document record
POST   /documents/                  Create document record (metadata only)
GET    /documents/{id}              Get document metadata
PATCH  /documents/{id}              Update document metadata
DELETE /documents/{id}              Delete document record (+ file)
GET    /documents/{id}/download     Download the file
"""
import os
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, Pagination
from app.models.models import Company, Document, DocumentType, User
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentOut, DocumentListOut

router = APIRouter()

# Upload directory — relative to backend root
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=DocumentListOut)
async def list_documents(
    company_id: Optional[int] = Query(None),
    deal_id: Optional[int] = Query(None),
    doc_type: Optional[DocumentType] = Query(None),
    uploaded_by: Optional[int] = Query(None),
    is_confidential: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a paginated, filterable list of documents."""
    q = select(Document)

    if company_id is not None:
        q = q.where(Document.company_id == company_id)
    if deal_id is not None:
        q = q.where(Document.deal_id == deal_id)
    if doc_type:
        q = q.where(Document.doc_type == doc_type)
    if uploaded_by is not None:
        q = q.where(Document.uploaded_by == uploaded_by)
    if is_confidential is not None:
        q = q.where(Document.is_confidential == is_confidential)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(Document.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    docs = (await db.execute(q)).scalars().all()

    return DocumentListOut(
        total=total,
        items=[DocumentOut.model_validate(d) for d in docs],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Upload file  (multipart/form-data)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    company_id: Optional[int] = None,
    deal_id: Optional[int] = None,
    doc_type: DocumentType = DocumentType.OTHER,
    description: Optional[str] = None,
    is_confidential: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a file and create the corresponding document record."""
    # Validate company if provided
    if company_id:
        company_q = await db.execute(
            select(Company).where(Company.id == company_id, Company.is_active == True)
        )
        if not company_q.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Company not found")

    # Save file to disk
    ext = os.path.splitext(file.filename or "")[-1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    sub_dir = f"company_{company_id}" if company_id else "misc"
    save_dir = os.path.join(UPLOAD_DIR, sub_dir)
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, unique_name)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    relative_path = os.path.join(sub_dir, unique_name)

    doc = Document(
        company_id=company_id,
        deal_id=deal_id,
        doc_type=doc_type,
        filename=file.filename or unique_name,
        file_path=relative_path,
        file_size_bytes=len(contents),
        mime_type=file.content_type,
        description=description,
        is_confidential=is_confidential,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


# ─────────────────────────────────────────────────────────────────────────────
# Create (metadata only — for pre-uploaded or external files)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    body: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a document metadata record (file already stored elsewhere)."""
    if body.company_id:
        company_q = await db.execute(
            select(Company).where(Company.id == body.company_id, Company.is_active == True)
        )
        if not company_q.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Company not found")

    data = body.model_dump()
    if data.get("uploaded_by") is None:
        data["uploaded_by"] = current_user.id

    doc = Document(**data)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


# ─────────────────────────────────────────────────────────────────────────────
# Get one
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut.model_validate(doc)


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{document_id}", response_model=DocumentOut)
async def update_document(
    document_id: int,
    body: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


# ─────────────────────────────────────────────────────────────────────────────
# Delete
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove file from disk if it exists
    full_path = os.path.join(UPLOAD_DIR, doc.file_path)
    if os.path.exists(full_path):
        os.remove(full_path)

    await db.delete(doc)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Download
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return the raw file for download."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    full_path = os.path.join(UPLOAD_DIR, doc.file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=full_path,
        filename=doc.filename,
        media_type=doc.mime_type or "application/octet-stream",
    )
