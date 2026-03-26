"""
Gmail Email Integration Routes
================================
GET    /email/threads/stats             Aggregate inbox stats
GET    /email/threads/                  List with filters (is_broker, is_processed, date range, matched/unmatched)
POST   /email/threads/                  Create / upsert thread (from Gmail sync)
GET    /email/threads/{id}              Full thread detail
PATCH  /email/threads/{id}             Update thread metadata
DELETE /email/threads/{id}             Delete thread
POST   /email/threads/{id}/link         Manually link to company
POST   /email/threads/{id}/create-company  Extract + return prefill dict via Claude
POST   /email/threads/{id}/confirm-company Actually create Company from prefill
POST   /email/threads/{id}/mark-processed  Mark as processed
POST   /email/threads/{id}/mark-read        Mark as read
GET    /email/oauth/authorize           Start OAuth2 flow (redirect)
GET    /email/oauth/callback            OAuth2 callback
DELETE /email/oauth/disconnect          Revoke credentials
POST   /email/sync                      Trigger manual sync
GET    /email/sync/status               Last sync status
GET    /email/suggested/                List suggested companies
POST   /email/suggested/{id}/promote    Promote to real Company
POST   /email/suggested/{id}/dismiss    Dismiss suggestion
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, Pagination
from app.models.models import (
    Company, DealStage, EmailThread, GmailCredentials,
    SuggestedCompany, User,
)
from app.schemas.email_thread import (
    EmailThreadCreate, EmailThreadOut, EmailThreadUpdate, EmailThreadListOut,
)

router = APIRouter()


# ─── Pydantic helpers ─────────────────────────────────────────────────────────

class LinkRequest(BaseModel):
    company_id: int


class CreateCompanyRequest(BaseModel):
    use_ai: bool = True
    override_fields: Optional[Dict[str, Any]] = None


class SuggestedCompanyOut(BaseModel):
    id: int
    name: str
    industry: Optional[str] = None
    location: Optional[str] = None
    asking_price: Optional[float] = None
    revenue: Optional[float] = None
    ebitda: Optional[float] = None
    broker_name: Optional[str] = None
    broker_email: Optional[str] = None
    status: str
    source_thread_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/threads/stats")
async def thread_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return aggregate inbox stats."""
    total = (await db.execute(select(func.count(EmailThread.id)))).scalar() or 0
    unread = (await db.execute(
        select(func.count(EmailThread.id)).where(EmailThread.is_unread == True)
    )).scalar() or 0
    broker_threads = (await db.execute(
        select(func.count(EmailThread.id)).where(EmailThread.is_broker == True)
    )).scalar() or 0
    unprocessed = (await db.execute(
        select(func.count(EmailThread.id)).where(
            and_(EmailThread.is_broker == True, EmailThread.is_processed == False)
        )
    )).scalar() or 0
    unmatched = (await db.execute(
        select(func.count(EmailThread.id)).where(
            and_(EmailThread.is_broker == True, EmailThread.matched_company_id.is_(None))
        )
    )).scalar() or 0
    pending_suggestions = (await db.execute(
        select(func.count(SuggestedCompany.id)).where(SuggestedCompany.status == "pending")
    )).scalar() or 0

    return {
        "total": total,
        "unread": unread,
        "broker_threads": broker_threads,
        "unprocessed": unprocessed,
        "unmatched_broker": unmatched,
        "pending_suggestions": pending_suggestions,
    }


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("/threads/", response_model=EmailThreadListOut)
async def list_email_threads(
    company_id: Optional[int] = Query(None),
    is_broker: Optional[bool] = Query(None),
    is_unread: Optional[bool] = Query(None),
    is_processed: Optional[bool] = Query(None),
    matched: Optional[bool] = Query(None, description="True=matched, False=unmatched"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    sender_email: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a paginated, filterable list of email threads."""
    q = select(EmailThread)
    filters = []

    if company_id is not None:
        filters.append(
            or_(EmailThread.company_id == company_id,
                EmailThread.matched_company_id == company_id)
        )
    if is_broker is not None:
        filters.append(EmailThread.is_broker == is_broker)
    if is_unread is not None:
        filters.append(EmailThread.is_unread == is_unread)
    if is_processed is not None:
        filters.append(EmailThread.is_processed == is_processed)
    if matched is True:
        filters.append(EmailThread.matched_company_id.isnot(None))
    if matched is False:
        filters.append(EmailThread.matched_company_id.is_(None))
    if date_from:
        filters.append(EmailThread.received_at >= date_from)
    if date_to:
        filters.append(EmailThread.received_at <= date_to)
    if sender_email:
        filters.append(EmailThread.sender_email.ilike(f"%{sender_email}%"))
    if search:
        term = f"%{search}%"
        filters.append(or_(
            EmailThread.subject.ilike(term),
            EmailThread.snippet.ilike(term),
            EmailThread.sender_email.ilike(term),
        ))

    if filters:
        q = q.where(and_(*filters))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = (q.order_by(EmailThread.received_at.desc())
          .offset(pagination.skip)
          .limit(pagination.limit))
    threads = (await db.execute(q)).scalars().all()

    return EmailThreadListOut(
        total=total,
        items=[EmailThreadOut.model_validate(t) for t in threads],
    )


# ─── Create / upsert ─────────────────────────────────────────────────────────

@router.post("/threads/", response_model=EmailThreadOut, status_code=status.HTTP_201_CREATED)
async def create_email_thread(
    body: EmailThreadCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create or upsert an email thread (upsert by gmail_thread_id)."""
    if body.gmail_thread_id:
        existing_q = await db.execute(
            select(EmailThread).where(EmailThread.gmail_thread_id == body.gmail_thread_id)
        )
        existing = existing_q.scalar_one_or_none()
        if existing:
            for field, value in body.model_dump(exclude_unset=True).items():
                setattr(existing, field, value)
            await db.commit()
            await db.refresh(existing)
            return EmailThreadOut.model_validate(existing)

    thread = EmailThread(**body.model_dump())
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return EmailThreadOut.model_validate(thread)


# ─── Get one ─────────────────────────────────────────────────────────────────

@router.get("/threads/{thread_id}", response_model=EmailThreadOut)
async def get_email_thread(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(EmailThread).where(EmailThread.id == thread_id))
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    return EmailThreadOut.model_validate(thread)


# ─── Update ──────────────────────────────────────────────────────────────────

@router.patch("/threads/{thread_id}", response_model=EmailThreadOut)
async def update_email_thread(
    thread_id: int,
    body: EmailThreadUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(EmailThread).where(EmailThread.id == thread_id))
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(thread, field, value)
    await db.commit()
    await db.refresh(thread)
    return EmailThreadOut.model_validate(thread)


# ─── Delete ──────────────────────────────────────────────────────────────────

@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_thread(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(EmailThread).where(EmailThread.id == thread_id))
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    await db.delete(thread)
    await db.commit()


# ─── Link to company ─────────────────────────────────────────────────────────

@router.post("/threads/{thread_id}/link", response_model=EmailThreadOut)
async def link_thread_to_company(
    thread_id: int,
    body: LinkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually link a thread to an existing company."""
    thread = (await db.execute(
        select(EmailThread).where(EmailThread.id == thread_id)
    )).scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")

    company = (await db.execute(
        select(Company).where(Company.id == body.company_id)
    )).scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    thread.matched_company_id = body.company_id
    thread.company_id = body.company_id
    thread.linked_by = current_user.username
    thread.is_processed = True
    await db.commit()
    await db.refresh(thread)
    return EmailThreadOut.model_validate(thread)


# ─── Create company from email (Claude prefill) ───────────────────────────────

@router.post("/threads/{thread_id}/create-company")
async def create_company_from_email(
    thread_id: int,
    body: CreateCompanyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Use Claude to parse the email and return pre-filled company fields.
    Returns the prefill dict for the frontend form — does NOT create the company yet.
    """
    thread = (await db.execute(
        select(EmailThread).where(EmailThread.id == thread_id)
    )).scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")

    from app.gmail.parser import extract_company_from_email, build_company_prefill

    extracted = await extract_company_from_email(
        subject=thread.subject or "",
        sender=thread.sender_email or "",
        body=thread.full_body or thread.snippet or "",
    )

    prefill = build_company_prefill(extracted)

    if body.override_fields:
        prefill.update(body.override_fields)

    return {
        "prefill": prefill,
        "raw_extract": extracted,
        "thread_id": thread_id,
        "source_email": thread.sender_email,
    }


@router.post("/threads/{thread_id}/confirm-company")
async def confirm_create_company(
    thread_id: int,
    company_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actually create the Company record from the confirmed prefill data.
    Links the email thread to the new company.
    """
    thread = (await db.execute(
        select(EmailThread).where(EmailThread.id == thread_id)
    )).scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")

    allowed_fields = {
        "name", "industry", "sub_industry", "city", "state",
        "asking_price", "annual_revenue", "ebitda", "ebitda_margin",
        "employees", "founded_year", "owner_name", "owner_email",
        "owner_phone", "description", "listing_url", "entity_type",
        "deal_stage", "source", "lead_partner",
    }
    create_data = {k: v for k, v in company_data.items() if k in allowed_fields and v is not None}

    if not create_data.get("name"):
        raise HTTPException(status_code=400, detail="Company name is required")

    create_data.setdefault("deal_stage", DealStage.PROSPECT)
    create_data.setdefault("source", "email")
    create_data.setdefault("lead_partner", current_user.username)

    company = Company(**create_data)
    db.add(company)
    await db.flush()

    thread.matched_company_id = company.id
    thread.company_id = company.id
    thread.linked_by = current_user.username
    thread.is_processed = True

    await db.commit()
    return {
        "ok": True,
        "company_id": company.id,
        "company_name": company.name,
        "thread_id": thread_id,
    }


# ─── Mark processed / read ───────────────────────────────────────────────────

@router.post("/threads/{thread_id}/process", response_model=EmailThreadOut)
async def mark_thread_processed(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Mark an email thread as processed."""
    result = await db.execute(select(EmailThread).where(EmailThread.id == thread_id))
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    thread.is_processed = True
    thread.is_unread = False
    await db.commit()
    await db.refresh(thread)
    return EmailThreadOut.model_validate(thread)


@router.post("/threads/{thread_id}/mark-read")
async def mark_thread_read(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(EmailThread).where(EmailThread.id == thread_id))
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    thread.is_unread = False
    await db.commit()
    return {"ok": True}


# ─── OAuth2 Flow ──────────────────────────────────────────────────────────────

@router.get("/oauth/authorize")
async def gmail_oauth_authorize(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Redirect user to Google OAuth2 consent screen."""
    from app.core.config import settings as cfg
    if not cfg.GOOGLE_CLIENT_ID:
        # Return stub URL when not configured
        return {
            "url": "https://accounts.google.com/o/oauth2/v2/auth?stub=true",
            "status": "not_configured",
            "message": "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable Gmail OAuth",
        }

    from app.gmail.client import get_authorization_url
    state = secrets.token_urlsafe(16)
    request.session["oauth_state"] = state
    request.session["oauth_user_id"] = current_user.id
    auth_url = get_authorization_url(state=state)
    return RedirectResponse(url=auth_url)


@router.get("/oauth/callback")
async def gmail_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth2 callback, store tokens."""
    session_state = request.session.get("oauth_state") if request else None
    user_id = request.session.get("oauth_user_id") if request else None

    if session_state and state != session_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state — CSRF check failed")

    from app.gmail.client import exchange_code_for_tokens
    try:
        tokens = exchange_code_for_tokens(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {e}")

    if not user_id:
        raise HTTPException(status_code=400, detail="Session expired. Please try again.")

    # Try to get Gmail address
    email_address = None
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from app.core.config import settings as cfg
        creds = Credentials(
            token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=cfg.GOOGLE_CLIENT_ID,
            client_secret=cfg.GOOGLE_CLIENT_SECRET,
        )
        svc = build("oauth2", "v2", credentials=creds, cache_discovery=False)
        info = svc.userinfo().get().execute()
        email_address = info.get("email")
    except Exception:
        pass

    # Upsert credentials
    existing = (await db.execute(
        select(GmailCredentials).where(GmailCredentials.user_id == user_id)
    )).scalar_one_or_none()

    if existing:
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens["refresh_token"]
        existing.token_expiry = tokens.get("token_expiry")
        existing.scopes = tokens.get("scopes", [])
        if email_address:
            existing.email_address = email_address
    else:
        db.add(GmailCredentials(
            user_id=user_id,
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_expiry=tokens.get("token_expiry"),
            scopes=tokens.get("scopes", []),
            email_address=email_address,
        ))

    await db.commit()
    # Redirect to the frontend settings page using the same host as the redirect URI
    from app.core.config import settings as cfg
    if "/api/" in cfg.GOOGLE_REDIRECT_URI:
        frontend_base = cfg.GOOGLE_REDIRECT_URI.split("/api/")[0]
    else:
        frontend_base = "http://localhost:5173"
    return RedirectResponse(url=f"{frontend_base}/settings?gmail=connected")


@router.delete("/oauth/disconnect")
async def gmail_oauth_disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove stored Gmail credentials."""
    creds = (await db.execute(
        select(GmailCredentials).where(GmailCredentials.user_id == current_user.id)
    )).scalar_one_or_none()
    if creds:
        await db.delete(creds)
        await db.commit()
    return {"ok": True, "message": "Gmail disconnected"}


# ─── Manual Sync ─────────────────────────────────────────────────────────────

@router.post("/sync")
async def trigger_gmail_sync(
    force_full: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a Gmail sync for the current user."""
    creds = (await db.execute(
        select(GmailCredentials).where(GmailCredentials.user_id == current_user.id)
    )).scalar_one_or_none()

    if not creds:
        raise HTTPException(
            status_code=400,
            detail="Gmail not connected. Authorize via GET /api/email/oauth/authorize"
        )

    # Try Celery first, fall back to inline
    try:
        from app.tasks.email_tasks import sync_gmail_task
        task = sync_gmail_task.delay(current_user.id, force_full)
        return {"ok": True, "task_id": task.id, "mode": "async"}
    except Exception:
        from app.gmail.client import sync_gmail_for_user
        stats = await sync_gmail_for_user(db, current_user.id, force_full=force_full)
        return {"ok": True, "mode": "sync", "stats": stats}


@router.get("/sync/status")
async def get_sync_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get Gmail connection and sync status."""
    creds = (await db.execute(
        select(GmailCredentials).where(GmailCredentials.user_id == current_user.id)
    )).scalar_one_or_none()

    if not creds:
        return {
            "is_connected": False,
            "email_address": None,
            "last_sync_at": None,
            "last_sync_status": None,
            "last_sync_error": None,
            "initial_sync_done": False,
            "history_id": None,
        }

    return {
        "is_connected": True,
        "email_address": creds.email_address,
        "last_sync_at": creds.last_sync_at.isoformat() if creds.last_sync_at else None,
        "last_sync_status": creds.last_sync_status,
        "last_sync_error": creds.last_sync_error,
        "initial_sync_done": creds.initial_sync_done,
        "history_id": creds.history_id,
    }


# ─── Suggested Companies ──────────────────────────────────────────────────────

@router.get("/suggested/")
async def list_suggested_companies(
    status_filter: Optional[str] = Query(None, alias="status"),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List auto-created suggested companies pending review."""
    q = select(SuggestedCompany)
    q = q.where(SuggestedCompany.status == (status_filter or "pending"))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(SuggestedCompany.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    rows = (await db.execute(q)).scalars().all()

    return {
        "total": total,
        "items": [SuggestedCompanyOut.model_validate(r) for r in rows],
    }


@router.post("/suggested/{suggestion_id}/promote")
async def promote_suggested_company(
    suggestion_id: int,
    extra_fields: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Promote a suggested company to a real Company record."""
    suggestion = await db.get(SuggestedCompany, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    company = Company(
        name=suggestion.name,
        industry=suggestion.industry,
        asking_price=suggestion.asking_price,
        annual_revenue=suggestion.revenue,
        ebitda=suggestion.ebitda,
        owner_name=suggestion.owner_name,
        owner_email=suggestion.owner_email,
        description=suggestion.description,
        deal_stage=DealStage.PROSPECT,
        source="email",
        lead_partner=current_user.username,
        **(extra_fields or {}),
    )
    db.add(company)
    await db.flush()

    suggestion.status = "promoted"
    suggestion.reviewed_by = current_user.username
    suggestion.promoted_company_id = company.id

    if suggestion.source_thread_id:
        thread = await db.get(EmailThread, suggestion.source_thread_id)
        if thread:
            thread.matched_company_id = company.id
            thread.is_processed = True

    await db.commit()
    return {"ok": True, "company_id": company.id, "company_name": company.name}


@router.post("/suggested/{suggestion_id}/dismiss")
async def dismiss_suggested_company(
    suggestion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dismiss a suggested company without creating a record."""
    suggestion = await db.get(SuggestedCompany, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    suggestion.status = "dismissed"
    suggestion.reviewed_by = current_user.username
    await db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Outbound send — DISABLED
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/send")
async def send_email_disabled(
    _: User = Depends(get_current_user),
):
    """
    Outbound email sending is currently disabled.
    All compose actions are for drafting only — no emails will be sent.
    """
    raise HTTPException(
        status_code=503,
        detail={
            "error": "outbound_disabled",
            "message": (
                "Outbound email sending is currently disabled. "
                "Emails cannot be sent from Evergreen Search at this time."
            ),
        },
    )
