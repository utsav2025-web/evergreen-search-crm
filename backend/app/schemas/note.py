"""
Pydantic schemas for the Note model.

Spec fields covered
-------------------
id, company_id, content, created_at, created_by, tagged_stage
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.models import DealStage


# ─────────────────────────────────────────────────────────────────────────────
# Shared base
# ─────────────────────────────────────────────────────────────────────────────

class NoteBase(BaseModel):
    # Spec: company_id
    company_id: Optional[int] = Field(None, description="Company this note belongs to")
    deal_id: Optional[int] = Field(None, description="Deal this note belongs to")
    # Spec: content
    content: str = Field(..., min_length=1, description="Note body (Markdown supported)")
    # Spec: tagged_stage  (pipeline stage when note was written)
    tagged_stage: Optional[DealStage] = None
    # Spec: created_by  (user FK — stored as author_id in DB)
    author_id: Optional[int] = Field(None, description="User who wrote the note")
    # general | meeting | call | analysis | diligence
    note_type: str = Field("general", max_length=50)
    is_pinned: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

class NoteCreate(NoteBase):
    """Payload for POST /notes/"""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

class NoteUpdate(BaseModel):
    """Payload for PATCH /notes/{id}"""
    content: Optional[str] = Field(None, min_length=1)
    tagged_stage: Optional[DealStage] = None
    note_type: Optional[str] = None
    is_pinned: Optional[bool] = None


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

class NoteOut(NoteBase):
    """Full note record returned from the API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Spec: created_at  (from TimestampMixin)
    created_at: datetime
    updated_at: datetime


class NoteListOut(BaseModel):
    """Paginated list response."""
    total: int
    items: List[NoteOut]
