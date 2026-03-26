"""
Outreach Log CRUD routes.

Endpoints
---------
GET    /outreach/stats              Aggregate stats
GET    /outreach/follow-ups         Entries with upcoming follow-up dates
GET    /outreach/                   List + filter outreach log entries
POST   /outreach/                   Create outreach log entry
GET    /outreach/{id}               Get single entry
PATCH  /outreach/{id}               Update entry
DELETE /outreach/{id}               Delete entry
POST   /outreach/{id}/complete      Mark outcome and optionally set follow-up
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, Pagination
from app.models.models import (
    Company, OutreachLog, OutreachOutcome, ContactMethod, User,
)
from app.schemas.outreach_log import (
    OutreachLogCreate, OutreachLogUpdate, OutreachLogOut, OutreachLogListOut,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Stats
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def outreach_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return aggregate outreach statistics."""
    total = (await db.execute(select(func.count(OutreachLog.id)))).scalar() or 0
    pending = (await db.execute(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.outcome == OutreachOutcome.PENDING
        )
    )).scalar() or 0
    replied = (await db.execute(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.outcome == OutreachOutcome.POSITIVE
        )
    )).scalar() or 0
    no_response = (await db.execute(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.outcome == OutreachOutcome.NO_RESPONSE
        )
    )).scalar() or 0
    follow_ups_due = (await db.execute(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.follow_up_date <= datetime.now(timezone.utc),
            OutreachLog.outcome == OutreachOutcome.PENDING,
        )
    )).scalar() or 0
    return {
        "total": total,
        "pending": pending,
        "replied": replied,  # maps to POSITIVE outcome
        "no_response": no_response,
        "follow_ups_due": follow_ups_due,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Follow-ups due
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/follow-ups", response_model=OutreachLogListOut)
async def list_follow_ups(
    days_ahead: int = Query(7, ge=1, le=90,
                            description="Show follow-ups due within N days"),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return outreach entries with follow-up dates within the next N days."""
    cutoff = datetime.now(timezone.utc) + timedelta(days=days_ahead)
    q = (
        select(OutreachLog)
        .where(
            OutreachLog.follow_up_date.isnot(None),
            OutreachLog.follow_up_date <= cutoff,
            OutreachLog.outcome == OutreachOutcome.PENDING,
        )
        .order_by(OutreachLog.follow_up_date.asc())
    )
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    entries = (await db.execute(q.offset(pagination.skip).limit(pagination.limit))).scalars().all()
    return OutreachLogListOut(
        total=total,
        items=[OutreachLogOut.model_validate(e) for e in entries],
    )


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=OutreachLogListOut)
async def list_outreach(
    company_id: Optional[int] = Query(None),
    contact_method: Optional[ContactMethod] = Query(None),
    outcome: Optional[OutreachOutcome] = Query(None),
    sent_by: Optional[int] = Query(None),
    has_follow_up: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a paginated, filterable outreach log."""
    q = select(OutreachLog)

    if company_id is not None:
        q = q.where(OutreachLog.company_id == company_id)
    if contact_method:
        q = q.where(OutreachLog.contact_method == contact_method)
    if outcome:
        q = q.where(OutreachLog.outcome == outcome)
    if sent_by is not None:
        q = q.where(OutreachLog.sent_by == sent_by)
    if has_follow_up is True:
        q = q.where(OutreachLog.follow_up_date.isnot(None))
    elif has_follow_up is False:
        q = q.where(OutreachLog.follow_up_date.is_(None))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(OutreachLog.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    entries = (await db.execute(q)).scalars().all()

    return OutreachLogListOut(
        total=total,
        items=[OutreachLogOut.model_validate(e) for e in entries],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=OutreachLogOut, status_code=status.HTTP_201_CREATED)
async def create_outreach_entry(
    body: OutreachLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a new outreach touchpoint."""
    company_q = await db.execute(
        select(Company).where(Company.id == body.company_id, Company.is_active == True)
    )
    if not company_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Company not found")

    data = body.model_dump()
    if data.get("sent_by") is None:
        data["sent_by"] = current_user.id

    entry = OutreachLog(**data)
    db.add(entry)

    # Update company's last_contacted_at
    company = (await db.execute(
        select(Company).where(Company.id == body.company_id)
    )).scalar_one_or_none()
    if company:
        company.last_contacted_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(entry)
    return OutreachLogOut.model_validate(entry)


# ─────────────────────────────────────────────────────────────────────────────
# Get one
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{entry_id}", response_model=OutreachLogOut)
async def get_outreach_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OutreachLog).where(OutreachLog.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Outreach entry not found")
    return OutreachLogOut.model_validate(entry)


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{entry_id}", response_model=OutreachLogOut)
async def update_outreach_entry(
    entry_id: int,
    body: OutreachLogUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OutreachLog).where(OutreachLog.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Outreach entry not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return OutreachLogOut.model_validate(entry)


# ─────────────────────────────────────────────────────────────────────────────
# Delete
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_outreach_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OutreachLog).where(OutreachLog.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Outreach entry not found")
    await db.delete(entry)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Complete / set outcome
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{entry_id}/complete", response_model=OutreachLogOut)
async def complete_outreach_entry(
    entry_id: int,
    outcome: OutreachOutcome,
    follow_up_date: Optional[datetime] = None,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Set the outcome of an outreach entry and optionally schedule a follow-up."""
    result = await db.execute(
        select(OutreachLog).where(OutreachLog.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Outreach entry not found")

    entry.outcome = outcome
    if follow_up_date:
        entry.follow_up_date = follow_up_date
    if notes:
        entry.notes = notes

    await db.commit()
    await db.refresh(entry)
    return OutreachLogOut.model_validate(entry)
