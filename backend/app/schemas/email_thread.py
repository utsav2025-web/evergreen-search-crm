"""
Pydantic schemas for the EmailThread model.

Spec fields covered
-------------------
id, gmail_thread_id, subject, sender_email, snippet,
full_body, received_at, is_broker, matched_company_id, is_processed
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# Shared base
# ─────────────────────────────────────────────────────────────────────────────

class EmailThreadBase(BaseModel):
    # Spec: gmail_thread_id
    gmail_thread_id: Optional[str] = Field(None, max_length=255,
                                           description="Gmail API thread ID")
    # Spec: subject
    subject: Optional[str] = Field(None, max_length=500)
    # Spec: sender_email
    sender_email: Optional[str] = Field(None, max_length=255)
    # Spec: snippet  (Gmail 200-char preview)
    snippet: Optional[str] = None
    # Spec: full_body  (decoded HTML/text of most recent message)
    full_body: Optional[str] = None
    # Spec: received_at
    received_at: Optional[datetime] = None
    # Spec: is_broker
    is_broker: bool = False
    # Spec: matched_company_id
    matched_company_id: Optional[int] = None
    # Spec: is_processed
    is_processed: bool = False

    # Additional fields
    company_id: Optional[int] = None
    contact_id: Optional[int] = None
    message_count: int = 1
    is_unread: bool = True
    labels: List[str] = Field(default_factory=list)
    raw_messages: List[Dict[str, Any]] = Field(default_factory=list)
    linked_by: Optional[str] = Field(None, max_length=50,
                                     description="matt | utsav")


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

class EmailThreadCreate(EmailThreadBase):
    """Payload for POST /email/threads/ (from Gmail sync task)."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

class EmailThreadUpdate(BaseModel):
    """Payload for PATCH /email/threads/{id}"""
    subject: Optional[str] = None
    snippet: Optional[str] = None
    full_body: Optional[str] = None
    received_at: Optional[datetime] = None
    is_broker: Optional[bool] = None
    matched_company_id: Optional[int] = None
    company_id: Optional[int] = None
    contact_id: Optional[int] = None
    is_processed: Optional[bool] = None
    is_unread: Optional[bool] = None
    labels: Optional[List[str]] = None
    raw_messages: Optional[List[Dict[str, Any]]] = None
    linked_by: Optional[str] = None
    message_count: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

class EmailThreadOut(EmailThreadBase):
    """Full email thread record returned from the API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class EmailThreadListOut(BaseModel):
    """Paginated list response."""
    total: int
    items: List[EmailThreadOut]
