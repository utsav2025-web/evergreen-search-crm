"""
Pydantic schemas for the Document model.

Spec fields covered
-------------------
id, company_id, doc_type (nda/cim/loi/financial/dd/other),
filename, file_path, uploaded_by
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.models import DocumentType


# ─────────────────────────────────────────────────────────────────────────────
# Shared base
# ─────────────────────────────────────────────────────────────────────────────

class DocumentBase(BaseModel):
    # Spec: company_id
    company_id: Optional[int] = Field(None, description="Company this document belongs to")
    deal_id: Optional[int] = Field(None, description="Deal this document belongs to")
    # Spec: doc_type  (nda | cim | loi | financial | dd | other)
    doc_type: DocumentType = Field(..., description="Document category")
    # Spec: filename
    filename: str = Field(..., min_length=1, max_length=500,
                          description="Original file name with extension")
    # Spec: file_path  (relative path under /uploads/)
    file_path: str = Field(..., min_length=1, max_length=1000,
                           description="Storage path relative to upload root")
    # Spec: uploaded_by  (user FK)
    uploaded_by: Optional[int] = Field(None, description="User who uploaded the file")

    # Additional fields
    file_size_bytes: Optional[int] = Field(None, ge=0)
    mime_type: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    is_confidential: bool = True
    version: int = Field(1, ge=1)


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

class DocumentCreate(DocumentBase):
    """Payload for POST /documents/ (metadata after file upload)."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

class DocumentUpdate(BaseModel):
    """Payload for PATCH /documents/{id}"""
    doc_type: Optional[DocumentType] = None
    filename: Optional[str] = None
    description: Optional[str] = None
    is_confidential: Optional[bool] = None
    version: Optional[int] = None
    company_id: Optional[int] = None
    deal_id: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

class DocumentOut(DocumentBase):
    """Full document record returned from the API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class DocumentListOut(BaseModel):
    """Paginated list response."""
    total: int
    items: List[DocumentOut]
