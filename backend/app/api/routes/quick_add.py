"""
Quick-Add Company endpoint — used by the Dashboard widget.
No scraping. Accepts manual name/URL/description input only.

POST /quick-add/company  — create a company (no scraping)
"""
from __future__ import annotations

import re
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_write
from app.models.models import ActivityLog, Company, DealStage, Note, User

router = APIRouter()


# ─── Pydantic ─────────────────────────────────────────────────────────────────

class QuickAddRequest(BaseModel):
    name: str
    url: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    lead_partner: Optional[str] = None


class QuickAddResponse(BaseModel):
    company_id: int
    company_name: str
    deal_stage: str
    crm_url: str
    is_new: bool
    duplicate_warning: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _normalize_url(url: str) -> Optional[str]:
    url = url.strip()
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def _clean_domain(url: str) -> str:
    url = re.sub(r"https?://", "", url)
    return url.split("/")[0].replace("www.", "").lower()


def _make_slug(name: str, suffix: str = "") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{suffix}" if suffix else slug


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/company", response_model=QuickAddResponse, status_code=201)
async def quick_add_company(
    body: QuickAddRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_write),
):
    """Create a company from the dashboard quick-add widget (no scraping)."""
    duplicate_warning: Optional[str] = None
    url = _normalize_url(body.url or "") or None

    # Dedup by domain
    if url:
        domain = _clean_domain(url)
        result = await db.execute(
            select(Company).where(
                Company.is_active == True,
                Company.website.ilike(f"%{domain}%"),
            ).limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            stage_str = str(existing.deal_stage).replace("DealStage.", "").lower()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "duplicate_domain",
                    "message": f"Already in CRM: {existing.name}",
                    "company_id": existing.id,
                    "company_name": existing.name,
                    "deal_stage": stage_str,
                    "crm_url": f"/companies/{existing.id}",
                },
            )

    # Dedup by name
    name_result = await db.execute(
        select(Company).where(
            Company.is_active == True,
            func.lower(Company.name) == body.name.lower().strip(),
        ).limit(1)
    )
    existing_by_name = name_result.scalar_one_or_none()
    if existing_by_name:
        duplicate_warning = f"A company with a similar name already exists: {existing_by_name.name}"

    # Build notes
    notes_parts = []
    if body.notes:
        notes_parts.append(body.notes)
    notes_parts.append(
        f"[Added via Dashboard Quick-Add by {current_user.display_name or current_user.username}]"
    )
    combined_notes = "\n".join(notes_parts)

    # Create slug
    slug = _make_slug(body.name)
    slug_check = await db.execute(select(Company).where(Company.slug == slug).limit(1))
    if slug_check.scalar_one_or_none():
        slug = _make_slug(body.name, str(int(time.time()))[-4:])

    company = Company(
        name=body.name.strip(),
        slug=slug,
        website=url,
        industry=body.industry,
        description=body.description,
        city=body.city,
        state=body.state,
        lead_partner=body.lead_partner or current_user.username,
        deal_stage=DealStage.PROSPECT,
        source="Dashboard Quick-Add",
        is_active=True,
    )
    db.add(company)
    await db.flush()

    note = Note(
        company_id=company.id,
        content=combined_notes,
        author_id=current_user.id,
        note_type="general",
    )
    db.add(note)

    log = ActivityLog(
        company_id=company.id,
        user_id=current_user.id,
        actor_name=current_user.display_name or current_user.username,
        action_type="created",
        description=f"Added via Dashboard Quick-Add by {current_user.display_name or current_user.username}",
    )
    db.add(log)
    await db.commit()
    await db.refresh(company)

    stage_str = str(company.deal_stage).replace("DealStage.", "").lower()
    return QuickAddResponse(
        company_id=company.id,
        company_name=company.name,
        deal_stage=stage_str,
        crm_url=f"/companies/{company.id}",
        is_new=True,
        duplicate_warning=duplicate_warning,
    )
