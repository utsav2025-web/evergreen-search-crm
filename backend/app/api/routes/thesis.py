"""
Investment Thesis API
=====================
GET  /api/thesis/config           — get current thesis config
PUT  /api/thesis/config           — update thesis config
POST /api/thesis/score/{company_id} — score a single company
POST /api/thesis/score/bulk       — re-score all companies
GET  /api/thesis/leaderboard      — top-scored companies
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import Company, ThesisConfig, User, Notification
from app.scoring.thesis_scorer import score_company

router = APIRouter(tags=["thesis"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class ThesisConfigIn(BaseModel):
    ebitda_min: Optional[float] = None
    ebitda_max: Optional[float] = None
    revenue_min: Optional[float] = None
    revenue_max: Optional[float] = None
    ebitda_margin_min: Optional[float] = None
    gross_margin_min: Optional[float] = None
    max_ev_ebitda_multiple: Optional[float] = None
    min_ev_ebitda_multiple: Optional[float] = None
    target_industries: Optional[List[str]] = None
    excluded_industries: Optional[List[str]] = None
    target_states: Optional[List[str]] = None
    min_years_in_business: Optional[int] = None
    max_employees: Optional[int] = None
    stall_lead_days: Optional[int] = None
    stall_prospect_days: Optional[int] = None
    stall_contacted_days: Optional[int] = None
    stall_nda_days: Optional[int] = None
    stall_cim_days: Optional[int] = None
    stall_model_days: Optional[int] = None
    stall_ioi_days: Optional[int] = None
    stall_loi_days: Optional[int] = None
    stall_dd_days: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _thesis_to_dict(t: ThesisConfig) -> dict:
    return {
        "id": t.id,
        "ebitda_min": t.ebitda_min,
        "ebitda_max": t.ebitda_max,
        "revenue_min": t.revenue_min,
        "revenue_max": t.revenue_max,
        "ebitda_margin_min": t.ebitda_margin_min,
        "gross_margin_min": t.gross_margin_min,
        "max_ev_ebitda_multiple": t.max_ev_ebitda_multiple,
        "min_ev_ebitda_multiple": t.min_ev_ebitda_multiple,
        "target_industries": t.target_industries or [],
        "excluded_industries": t.excluded_industries or [],
        "target_states": t.target_states or [],
        "min_years_in_business": t.min_years_in_business,
        "max_employees": t.max_employees,
        "stall_lead_days": t.stall_lead_days,
        "stall_prospect_days": t.stall_prospect_days,
        "stall_contacted_days": t.stall_contacted_days,
        "stall_nda_days": t.stall_nda_days,
        "stall_cim_days": t.stall_cim_days,
        "stall_model_days": t.stall_model_days,
        "stall_ioi_days": t.stall_ioi_days,
        "stall_loi_days": t.stall_loi_days,
        "stall_dd_days": t.stall_dd_days,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "updated_by": t.updated_by,
    }


async def _get_or_create_thesis(db: AsyncSession) -> ThesisConfig:
    result = await db.execute(select(ThesisConfig).limit(1))
    thesis = result.scalars().first()
    if not thesis:
        thesis = ThesisConfig()
        db.add(thesis)
        await db.commit()
        await db.refresh(thesis)
    return thesis


async def _score_and_save(company: Company, thesis: ThesisConfig, db: AsyncSession) -> dict:
    result = score_company(company, thesis)
    company.thesis_score = result["thesis_score"]
    company.thesis_flags = result["flags"]
    company.thesis_scored_at = datetime.now(timezone.utc)
    # Also update deal_score if not manually set
    if company.deal_score is None:
        company.deal_score = result["thesis_score"]
    await db.commit()
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_thesis_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    thesis = await _get_or_create_thesis(db)
    return _thesis_to_dict(thesis)


@router.put("/config")
async def update_thesis_config(
    payload: ThesisConfigIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thesis = await _get_or_create_thesis(db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(thesis, field, value)
    thesis.updated_by = current_user.username
    thesis.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(thesis)
    return _thesis_to_dict(thesis)


@router.post("/score/{company_id}")
async def score_single_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    thesis = await _get_or_create_thesis(db)
    result = await _score_and_save(company, thesis, db)
    return {
        "company_id": company_id,
        "company_name": company.name,
        **result,
    }


@router.post("/score/bulk")
async def score_all_companies(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Queue a background re-score of all active companies."""
    result = await db.execute(
        select(Company).where(Company.is_active == True)
    )
    companies = result.scalars().all()
    thesis = await _get_or_create_thesis(db)

    scored = 0
    for company in companies:
        await _score_and_save(company, thesis, db)
        scored += 1

    return {"scored": scored, "message": f"Re-scored {scored} companies against current thesis"}


@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 20,
    stage: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return top-scored companies ranked by thesis score."""
    q = select(Company).where(
        Company.is_active == True,
        Company.thesis_score != None,
    )
    if stage:
        q = q.where(Company.deal_stage == stage)
    q = q.order_by(Company.thesis_score.desc()).limit(limit)
    result = await db.execute(q)
    companies = result.scalars().all()

    return {
        "total": len(companies),
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "industry": c.industry,
                "state": c.state,
                "deal_stage": c.deal_stage,
                "thesis_score": c.thesis_score,
                "thesis_flags": c.thesis_flags or [],
                "ebitda": c.ebitda,
                "annual_revenue": c.annual_revenue,
                "asking_price": c.asking_price,
                "source": c.source,
            }
            for c in companies
        ],
    }


@router.get("/stalled")
async def get_stalled_deals(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return deals that have been in their current stage longer than the stall threshold."""
    thesis = await _get_or_create_thesis(db)
    now = datetime.now(timezone.utc)

    stall_map = {
        "lead": thesis.stall_lead_days or 7,
        "prospect": thesis.stall_prospect_days or 14,
        "contacted": thesis.stall_contacted_days or 21,
        "nda": thesis.stall_nda_days or 30,
        "cim": thesis.stall_cim_days or 21,
        "model": thesis.stall_model_days or 14,
        "ioi": thesis.stall_ioi_days or 14,
        "loi": thesis.stall_loi_days or 30,
        "dd": thesis.stall_dd_days or 60,
    }

    result = await db.execute(
        select(Company).where(
            Company.is_active == True,
            Company.deal_stage.notin_(["closed", "passed"]),
        )
    )
    companies = result.scalars().all()

    stalled = []
    for c in companies:
        stage_key = str(c.deal_stage.value if hasattr(c.deal_stage, "value") else c.deal_stage)
        threshold_days = stall_map.get(stage_key, 30)
        reference_date = c.stage_entered_at or c.updated_at or c.created_at
        if reference_date:
            # Make timezone-aware if naive
            if reference_date.tzinfo is None:
                reference_date = reference_date.replace(tzinfo=timezone.utc)
            days_in_stage = (now - reference_date).days
            if days_in_stage >= threshold_days:
                stalled.append({
                    "id": c.id,
                    "name": c.name,
                    "deal_stage": stage_key,
                    "days_in_stage": days_in_stage,
                    "threshold_days": threshold_days,
                    "thesis_score": c.thesis_score,
                    "last_activity": c.updated_at.isoformat() if c.updated_at else None,
                })

    stalled.sort(key=lambda x: x["days_in_stage"], reverse=True)
    return {"total": len(stalled), "items": stalled}
