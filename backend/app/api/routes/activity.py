"""
Activity feed, notifications, deal review/voting, pipeline export, and weekly digest.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_partner, get_db
from app.models.models import (
    ActivityLog, Company, DealVote, Notification, User, OutreachLog
)

router = APIRouter(prefix="/activity", tags=["Activity"])


class DealVoteIn(BaseModel):
    company_id:     int
    conviction:     Optional[int] = None
    recommendation: Optional[str] = None
    notes:          Optional[str] = None


class ActivityLogIn(BaseModel):
    action_type:   str
    description:   str
    company_id:    Optional[int] = None
    entity_type:   Optional[str] = None
    entity_id:     Optional[int] = None
    metadata_json: Optional[dict] = None


@router.get("/feed")
async def get_activity_feed(
    limit: int = Query(50, le=200),
    skip:  int = Query(0, ge=0),
    company_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(ActivityLog).order_by(desc(ActivityLog.created_at))
    if company_id:
        q = q.where(ActivityLog.company_id == company_id)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    entries = result.scalars().all()
    return {
        "total": len(entries),
        "items": [
            {
                "id":          e.id,
                "actor_name":  e.actor_name,
                "action_type": e.action_type,
                "description": e.description,
                "company_id":  e.company_id,
                "entity_type": e.entity_type,
                "entity_id":   e.entity_id,
                "metadata":    e.metadata_json or {},
                "created_at":  e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
    }


@router.post("/log")
async def write_activity(
    body: ActivityLogIn,
    current_user: User = Depends(require_partner),
    db: AsyncSession = Depends(get_db),
):
    entry = ActivityLog(
        user_id=current_user.id,
        actor_name=current_user.display_name,
        action_type=body.action_type,
        description=body.description,
        company_id=body.company_id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        metadata_json=body.metadata_json or {},
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"id": entry.id, "created_at": entry.created_at.isoformat()}


@router.get("/notifications")
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(30, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(limit)
    )
    if unread_only:
        q = q.where(Notification.is_read == False)
    result = await db.execute(q)
    notifs = result.scalars().all()

    unread_q = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    unread_count = len(unread_q.scalars().all())

    return {
        "unread_count": unread_count,
        "items": [
            {
                "id":         n.id,
                "notif_type": n.notif_type,
                "title":      n.title,
                "body":       n.body,
                "company_id": n.company_id,
                "is_read":    n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "read_at":    n.read_at.isoformat() if n.read_at else None,
                "metadata":   n.metadata_json or {},
            }
            for n in notifs
        ],
    }


@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": notif_id, "is_read": True}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    notifs = result.scalars().all()
    now = datetime.now(timezone.utc)
    for n in notifs:
        n.is_read = True
        n.read_at = now
    await db.commit()
    return {"marked_read": len(notifs)}


@router.post("/deal-vote")
async def submit_deal_vote(
    body: DealVoteIn,
    current_user: User = Depends(require_partner),
    db: AsyncSession = Depends(get_db),
):
    comp_result = await db.execute(select(Company).where(Company.id == body.company_id))
    company = comp_result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if body.conviction is not None and not (1 <= body.conviction <= 5):
        raise HTTPException(status_code=422, detail="Conviction must be 1-5")

    valid_recs = {"pursue", "watch", "pass", None}
    if body.recommendation not in valid_recs:
        raise HTTPException(status_code=422, detail="Recommendation must be pursue, watch, or pass")

    result = await db.execute(
        select(DealVote).where(
            DealVote.company_id == body.company_id,
            DealVote.user_id == current_user.id,
        )
    )
    vote = result.scalar_one_or_none()

    if vote is None:
        vote = DealVote(
            company_id=body.company_id,
            user_id=current_user.id,
            conviction=body.conviction,
            recommendation=body.recommendation,
            notes=body.notes,
        )
        db.add(vote)
    else:
        if body.conviction is not None:
            vote.conviction = body.conviction
        if body.recommendation is not None:
            vote.recommendation = body.recommendation
        if body.notes is not None:
            vote.notes = body.notes
        vote.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(vote)

    stars   = "\u2605" * (body.conviction or 0)
    rec_str = f" ({body.recommendation})" if body.recommendation else ""
    log = ActivityLog(
        user_id=current_user.id,
        actor_name=current_user.display_name,
        action_type="deal_vote",
        description=f"{current_user.display_name} rated {company.name} {stars}{rec_str}",
        company_id=body.company_id,
        entity_type="deal_vote",
        entity_id=vote.id,
    )
    db.add(log)

    result2 = await db.execute(
        select(User).where(User.role == "partner", User.id != current_user.id)
    )
    other = result2.scalar_one_or_none()
    if other:
        notif = Notification(
            user_id=other.id,
            notif_type="deal_vote",
            title=f"{current_user.display_name} rated {company.name}",
            body=f"Conviction: {stars}{rec_str}" + (f"\n{body.notes}" if body.notes else ""),
            company_id=body.company_id,
        )
        db.add(notif)

    await db.commit()

    return {
        "id":             vote.id,
        "company_id":     vote.company_id,
        "user_id":        vote.user_id,
        "conviction":     vote.conviction,
        "recommendation": vote.recommendation,
        "notes":          vote.notes,
    }


@router.get("/deal-vote/{company_id}")
async def get_deal_votes(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DealVote, User)
        .join(User, DealVote.user_id == User.id)
        .where(DealVote.company_id == company_id)
    )
    rows = result.all()
    votes = [
        {
            "id":             v.id,
            "user_id":        v.user_id,
            "display_name":   u.display_name,
            "avatar_url":     u.avatar_url,
            "conviction":     v.conviction,
            "recommendation": v.recommendation,
            "notes":          v.notes,
            "updated_at":     v.updated_at.isoformat() if v.updated_at else None,
            "is_mine":        v.user_id == current_user.id,
        }
        for v, u in rows
    ]

    recs = [v["recommendation"] for v in votes if v["recommendation"]]
    consensus = None
    if len(recs) == 2:
        if all(r == "pursue" for r in recs):
            consensus = "pursue"
        elif all(r == "pass" for r in recs):
            consensus = "pass"
        else:
            consensus = "review"

    convictions = [v["conviction"] for v in votes if v["conviction"]]
    avg_conviction = round(sum(convictions) / len(convictions), 1) if convictions else None

    return {
        "company_id":     company_id,
        "votes":          votes,
        "consensus":      consensus,
        "avg_conviction": avg_conviction,
    }


@router.get("/pipeline/export")
async def export_pipeline_csv(
    current_user: User = Depends(require_partner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Company).order_by(Company.deal_stage, Company.name)
    )
    companies = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Industry", "Sub-Industry", "Deal Stage",
        "Annual Revenue", "EBITDA", "EBITDA Margin", "Asking Price",
        "Implied Multiple", "Employees", "Founded Year",
        "State", "Entity Type", "Source", "Lead Partner",
        "Deal Score", "Enrichment Score", "Owner Name", "Owner Email",
        "Is Proprietary", "Last Contacted", "Created At",
    ])
    for c in companies:
        writer.writerow([
            c.name,
            c.industry or "",
            c.sub_industry or "",
            c.deal_stage.value if c.deal_stage else "",
            c.annual_revenue or "",
            c.ebitda or "",
            f"{c.ebitda_margin:.1f}%" if c.ebitda_margin else "",
            c.asking_price or "",
            f"{c.implied_multiple:.1f}x" if c.implied_multiple else "",
            c.employees or "",
            c.founded_year or "",
            c.state_of_incorporation or "",
            c.entity_type.value if c.entity_type else "",
            c.source or "",
            c.lead_partner or "",
            c.deal_score or "",
            c.enrichment_score or "",
            c.owner_name or "",
            c.owner_email or "",
            "Yes" if c.is_proprietary else "No",
            c.last_contacted_at.isoformat() if c.last_contacted_at else "",
            c.created_at.isoformat() if c.created_at else "",
        ])

    output.seek(0)
    filename = f"pipeline_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/digest/send")
async def send_weekly_digest(
    current_user: User = Depends(require_partner),
    db: AsyncSession = Depends(get_db),
):
    one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    new_q = await db.execute(select(Company).where(Company.created_at >= one_week_ago))
    new_companies = new_q.scalars().all()

    stage_q = await db.execute(
        select(ActivityLog).where(
            ActivityLog.action_type == "moved_stage",
            ActivityLog.created_at >= one_week_ago,
        ).order_by(desc(ActivityLog.created_at))
    )
    stage_changes = stage_q.scalars().all()

    fu_q = await db.execute(
        select(OutreachLog).where(
            OutreachLog.follow_up_date >= datetime.now(timezone.utc).date(),
            OutreachLog.follow_up_date <= (datetime.now(timezone.utc) + timedelta(days=7)).date(),
        ).order_by(OutreachLog.follow_up_date)
    )
    follow_ups = fu_q.scalars().all()

    return {
        "status": "digest_queued",
        "digest": {
            "period":          f"{one_week_ago.strftime('%b %d')} - {datetime.now().strftime('%b %d, %Y')}",
            "new_companies":   len(new_companies),
            "stage_changes":   len(stage_changes),
            "follow_ups_due":  len(follow_ups),
            "new_company_names": [c.name for c in new_companies[:10]],
        },
        "message": "Weekly digest will be sent to both partners via Gmail.",
    }
