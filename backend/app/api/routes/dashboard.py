"""
Dashboard summary endpoint.

GET /api/dashboard/summary  — KPI counts, new listings, emails to review,
                              follow-ups due today, activity feed
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import (
    Company, BrokerListing, EmailThread, OutreachLog,
    Note, CallLog, DealStage, User,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _stage_count(companies: List[Company], stage: DealStage) -> int:
    return sum(1 for c in companies if c.deal_stage == stage)


def _isoformat(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


# ── main endpoint ─────────────────────────────────────────────────────────────

@router.get("/summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns:
    - kpis: pipeline stage counts, calls this week
    - new_this_week: new broker listings + unreviewed emails
    - follow_ups_due: outreach with follow_up_date <= today
    - activity_feed: last 50 actions across all models
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    week_ago = now - timedelta(days=7)

    # ── 1. Fetch all active companies (cheap — typically < 500) ───────────────
    all_companies_result = await db.execute(
        select(Company).where(Company.is_active == True)
    )
    all_companies = all_companies_result.scalars().all()

    active_stages = {
        DealStage.CONTACTED, DealStage.NDA, DealStage.CIM,
        DealStage.MODEL, DealStage.IOI, DealStage.LOI, DealStage.DILIGENCE,
    }
    active_pipeline = sum(1 for c in all_companies if c.deal_stage in active_stages)

    # Calls this week
    calls_result = await db.execute(
        select(func.count(CallLog.id)).where(
            CallLog.created_at >= week_ago
        )
    )
    calls_this_week = calls_result.scalar() or 0

    kpis = {
        "total_prospects": len(all_companies),
        "active_pipeline": active_pipeline,
        "lead": _stage_count(all_companies, DealStage.LEAD),
        "prospect": _stage_count(all_companies, DealStage.PROSPECT),
        "contacted": _stage_count(all_companies, DealStage.CONTACTED),
        "nda": _stage_count(all_companies, DealStage.NDA),
        "cim": _stage_count(all_companies, DealStage.CIM),
        "model": _stage_count(all_companies, DealStage.MODEL),
        "ioi": _stage_count(all_companies, DealStage.IOI),
        "loi": _stage_count(all_companies, DealStage.LOI),
        "diligence": _stage_count(all_companies, DealStage.DILIGENCE),
        "calls_this_week": calls_this_week,
    }

    # ── 2. New this week ──────────────────────────────────────────────────────
    new_listings_result = await db.execute(
        select(BrokerListing)
        .where(BrokerListing.date_scraped >= week_ago)
        .order_by(BrokerListing.date_scraped.desc())
        .limit(10)
    )
    new_listings = new_listings_result.scalars().all()

    unreviewed_emails_result = await db.execute(
        select(EmailThread)
        .where(
            EmailThread.is_broker == True,
            EmailThread.is_processed == False,
        )
        .order_by(EmailThread.received_at.desc())
        .limit(10)
    )
    unreviewed_emails = unreviewed_emails_result.scalars().all()

    new_this_week = {
        "broker_listings": [
            {
                "id": bl.id,
                "business_name": bl.business_name,
                "asking_price": bl.asking_price,
                "revenue": bl.revenue,
                "ebitda": bl.ebitda,
                "location": bl.location,
                "industry": bl.industry,
                "broker_site": bl.broker_site,
                "date_scraped": _isoformat(bl.date_scraped),
                "is_new": bl.is_new,
                "matched_company_id": bl.matched_company_id,
            }
            for bl in new_listings
        ],
        "unreviewed_emails": [
            {
                "id": et.id,
                "subject": et.subject,
                "sender_email": et.sender_email,
                "snippet": et.snippet,
                "received_at": _isoformat(et.received_at),
                "matched_company_id": et.matched_company_id,
            }
            for et in unreviewed_emails
        ],
    }

    # ── 3. Follow-ups due today ───────────────────────────────────────────────
    follow_ups_result = await db.execute(
        select(OutreachLog, Company)
        .join(Company, OutreachLog.company_id == Company.id, isouter=True)
        .where(
            OutreachLog.follow_up_date != None,
            func.date(OutreachLog.follow_up_date) <= today,
            or_(
                OutreachLog.outcome == None,
                OutreachLog.outcome == "pending",
            ),
        )
        .order_by(OutreachLog.follow_up_date.asc())
        .limit(20)
    )
    follow_up_rows = follow_ups_result.all()

    follow_ups_due = [
        {
            "id": ol.id,
            "company_id": ol.company_id,
            "company_name": c.name if c else None,
            "contact_method": ol.contact_method,
            "notes": ol.notes,
            "follow_up_date": _isoformat(ol.follow_up_date),
            "sent_by": ol.sent_by,
            "days_overdue": (today - ol.follow_up_date.date()).days if ol.follow_up_date else 0,
        }
        for ol, c in follow_up_rows
    ]

    # ── 4. Activity feed (last 50 actions) ────────────────────────────────────
    activity: List[Dict[str, Any]] = []

    # Recent outreach
    recent_outreach_result = await db.execute(
        select(OutreachLog, Company)
        .join(Company, OutreachLog.company_id == Company.id, isouter=True)
        .order_by(OutreachLog.created_at.desc())
        .limit(20)
    )
    for ol, c in recent_outreach_result.all():
        method = str(ol.contact_method).replace('ContactMethod.', '').replace('_', ' ').title() if ol.contact_method else 'Email'
        direction = str(ol.direction).replace('OutreachDirection.', '').title() if ol.direction else 'Outbound'
        outcome = str(ol.outcome or 'pending').replace('OutreachOutcome.', '').replace('_', ' ').title()
        activity.append({
            "type": "outreach",
            "id": ol.id,
            "company_id": ol.company_id,
            "company_name": c.name if c else None,
            "description": f"{method} {direction} — {outcome}",
            "actor": ol.sent_by,
            "timestamp": _isoformat(ol.created_at),
        })

    # Recent notes
    recent_notes_result = await db.execute(
        select(Note, Company)
        .join(Company, Note.company_id == Company.id, isouter=True)
        .order_by(Note.created_at.desc())
        .limit(20)
    )
    for n, c in recent_notes_result.all():
        activity.append({
            "type": "note",
            "id": n.id,
            "company_id": n.company_id,
            "company_name": c.name if c else None,
            "description": (n.content or "")[:120],
            "actor": str(n.author_id) if n.author_id else None,
            "timestamp": _isoformat(n.created_at),
        })

    # Recent stage changes (companies updated recently)
    recent_stage_result = await db.execute(
        select(Company)
        .where(Company.is_active == True, Company.updated_at >= week_ago)
        .order_by(Company.updated_at.desc())
        .limit(15)
    )
    for c in recent_stage_result.scalars().all():
        activity.append({
            "type": "stage_change",
            "id": c.id,
            "company_id": c.id,
            "company_name": c.name,
            "description": f"Stage: {str(c.deal_stage).replace('DealStage.', '').replace('_', ' ').title()}",
            "actor": c.lead_partner,
            "timestamp": _isoformat(c.updated_at),
        })

    # Sort by timestamp desc, take top 50
    activity.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    activity = activity[:50]

    return {
        "kpis": kpis,
        "new_this_week": new_this_week,
        "follow_ups_due": follow_ups_due,
        "activity_feed": activity,
        "generated_at": now.isoformat(),
    }
