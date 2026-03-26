"""
Email Ingestion — Google Cloud Pub/Sub Push Webhook.

Google sends a push notification to this endpoint when a new Gmail message arrives.
No background polling. No AI extraction. Raw email data is stored for manual review.

Endpoints:
  POST /email-ingest/pubsub          — receive Pub/Sub push notification (token-protected)
  GET  /email-ingest/                — list ingested emails
  GET  /email-ingest/{id}            — get a single ingested email
  PATCH /email-ingest/{id}/review    — mark as reviewed
  DELETE /email-ingest/{id}          — delete
  GET  /email-ingest/stats/summary   — aggregate stats
"""
from __future__ import annotations

import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import InboundEmail, User

logger = logging.getLogger(__name__)
router = APIRouter()

PUBSUB_TOKEN = os.getenv("PUBSUB_VERIFICATION_TOKEN", "")


# ─── Pydantic ─────────────────────────────────────────────────────────────────

class PubSubMessage(BaseModel):
    message: Dict[str, Any]
    subscription: Optional[str] = None


class InboundEmailOut(BaseModel):
    id: int
    from_address: Optional[str] = None
    subject: Optional[str] = None
    received_at: Optional[datetime] = None
    parse_status: str = "received"
    is_reviewed: bool = False

    class Config:
        from_attributes = True


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/pubsub")
async def pubsub_push(
    body: PubSubMessage,
    token: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Receive a Google Cloud Pub/Sub push notification for Gmail.
    Stores the raw message for manual review — no AI extraction.
    """
    if PUBSUB_TOKEN and token != PUBSUB_TOKEN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid token")

    raw_data = body.message.get("data", "")
    try:
        decoded = base64.b64decode(raw_data).decode("utf-8")
        payload = json.loads(decoded)
    except Exception:
        payload = {"raw": raw_data}

    from_address = payload.get("from") or payload.get("sender")
    subject = payload.get("subject")
    body_text = payload.get("body") or payload.get("snippet") or json.dumps(payload)

    email_record = InboundEmail(
        from_address=from_address,
        subject=subject,
        raw_body=body_text,
        raw_payload=json.dumps(payload),
        received_at=datetime.now(timezone.utc),
        parse_status="received",
        is_reviewed=False,
    )
    db.add(email_record)
    await db.commit()

    logger.info(f"Pub/Sub email received: from={from_address} subject={subject}")
    return {"ok": True}


@router.get("/stats/summary")
async def email_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    total = await db.scalar(select(func.count(InboundEmail.id)))
    reviewed = await db.scalar(
        select(func.count(InboundEmail.id)).where(InboundEmail.is_reviewed == True)
    )
    return {
        "total": total or 0,
        "reviewed": reviewed or 0,
        "pending": (total or 0) - (reviewed or 0),
    }


@router.get("/", response_model=List[InboundEmailOut])
async def list_emails(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InboundEmail)
        .order_by(InboundEmail.received_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{email_id}")
async def get_email(
    email_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(InboundEmail).where(InboundEmail.id == email_id))
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return email


@router.patch("/{email_id}/review")
async def mark_reviewed(
    email_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(InboundEmail).where(InboundEmail.id == email_id))
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    email.is_reviewed = True
    await db.commit()
    return {"ok": True}


@router.delete("/{email_id}")
async def delete_email(
    email_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(InboundEmail).where(InboundEmail.id == email_id))
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    await db.delete(email)
    await db.commit()
    return {"ok": True}
