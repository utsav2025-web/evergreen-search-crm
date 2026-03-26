"""
Pydantic schemas for the OutreachLog model.

Spec fields covered
-------------------
id, company_id, contact_method, direction, notes, outcome,
follow_up_date, created_at, sent_by
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.models import ContactMethod, OutreachDirection, OutreachOutcome


# ─────────────────────────────────────────────────────────────────────────────
# Shared base
# ─────────────────────────────────────────────────────────────────────────────

class OutreachLogBase(BaseModel):
    # Spec: company_id
    company_id: int = Field(..., description="Target company FK")
    # Spec: contact_method  (email | phone | linkedin | letter | in_person | other)
    contact_method: ContactMethod = Field(ContactMethod.EMAIL)
    # Spec: direction  (outbound | inbound)
    direction: OutreachDirection = Field(OutreachDirection.OUTBOUND)
    # Spec: notes
    notes: Optional[str] = None
    # Spec: outcome
    outcome: OutreachOutcome = Field(OutreachOutcome.PENDING)
    # Spec: follow_up_date
    follow_up_date: Optional[datetime] = None
    # Spec: sent_by  (username string or user ID)
    sent_by: Optional[str] = None

    # Additional fields
    contact_id: Optional[int] = None
    subject: Optional[str] = Field(None, max_length=500)
    body: Optional[str] = None
    sent_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    email_thread_id: Optional[int] = None
    sequence_step: int = Field(1, ge=1)
    template_used: Optional[str] = Field(None, max_length=100)


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

class OutreachLogCreate(OutreachLogBase):
    """Payload for POST /outreach/"""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

class OutreachLogUpdate(BaseModel):
    """Payload for PATCH /outreach/{id}"""
    contact_method: Optional[ContactMethod] = None
    direction: Optional[OutreachDirection] = None
    notes: Optional[str] = None
    outcome: Optional[OutreachOutcome] = None
    follow_up_date: Optional[datetime] = None
    contact_id: Optional[int] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    sent_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    email_thread_id: Optional[int] = None
    sequence_step: Optional[int] = None
    template_used: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

class OutreachLogOut(OutreachLogBase):
    """Full outreach log record returned from the API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Spec: created_at  (from TimestampMixin)
    created_at: datetime
    updated_at: datetime


class OutreachLogListOut(BaseModel):
    """Paginated list response."""
    total: int
    items: List[OutreachLogOut]
