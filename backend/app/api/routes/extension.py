"""
Chrome Extension API endpoints.

GET  /companies/check-domain?domain=example.com
     Quick lookup — is this domain already in the CRM?
     Returns: { exists, company_id, company_name, deal_stage, crm_url }

POST /companies/from-extension
     Create a company from the Chrome extension with deduplication.
     Requires partner auth (guests rejected).
"""
from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_write
from app.models.models import Company, DealStage, User
from app.schemas.company import CompanyOut

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _clean_domain(raw: str) -> str:
    """Normalise a URL or bare domain to its root hostname (no www.)."""
    raw = raw.strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    parsed = urlparse(raw)
    host = parsed.netloc or parsed.path
    host = re.sub(r"^www\.", "", host).lower()
    # strip port
    host = host.split(":")[0]
    return host


def _make_slug(name: str, suffix: str = "") -> str:
    try:
        from python_slugify import slugify
        base = slugify(name)
    except ImportError:
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{base}-{suffix}" if suffix else base


# ── schemas ───────────────────────────────────────────────────────────────────

class ExtensionCompanyIn(BaseModel):
    """Payload sent by the Chrome extension when adding a company."""
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    sub_industry: Optional[str] = None
    description: Optional[str] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    annual_revenue: Optional[float] = None
    asking_price: Optional[float] = None
    employees: Optional[int] = None
    founded_year: Optional[int] = None
    linkedin_url: Optional[str] = None
    lead_partner: Optional[str] = "matt"
    notes: Optional[str] = None
    # Internal flags
    save_for_later: bool = False        # True → add "needs_review" tag
    is_franchise: bool = False
    business_type: Optional[str] = None  # B2B service, manufacturing, etc.


class DomainCheckOut(BaseModel):
    exists: bool
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    deal_stage: Optional[str] = None
    crm_url: Optional[str] = None


class ExtensionCreateOut(BaseModel):
    company_id: int
    company_name: str
    deal_stage: str
    crm_url: str
    duplicate_warning: Optional[str] = None
    is_new: bool


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/companies/check-domain", response_model=DomainCheckOut)
async def check_domain(
    domain: str = Query(..., description="Domain or URL to check, e.g. example.com"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lightweight check used by the extension badge.
    Returns whether the domain is already in the CRM.
    Accessible to all authenticated users (including guests).
    """
    clean = _clean_domain(domain)
    if not clean:
        return DomainCheckOut(exists=False)

    # Search for any company whose website contains this domain
    result = await db.execute(
        select(Company).where(
            Company.is_active == True,
            Company.website.ilike(f"%{clean}%"),
        ).limit(1)
    )
    company = result.scalar_one_or_none()

    if company:
        stage_str = str(company.deal_stage).replace("DealStage.", "").lower()
        return DomainCheckOut(
            exists=True,
            company_id=company.id,
            company_name=company.name,
            deal_stage=stage_str,
            crm_url=f"/companies/{company.id}",
        )
    return DomainCheckOut(exists=False)


@router.post("/companies/from-extension", response_model=ExtensionCreateOut, status_code=201)
async def create_from_extension(
    body: ExtensionCompanyIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_write),
):
    """
    Create a company from the Chrome extension.
    Runs deduplication by name (fuzzy) and domain before creating.
    Guests are rejected (require_write).
    """
    duplicate_warning: Optional[str] = None

    # ── 1. Deduplication check ────────────────────────────────────────────────
    # Check by domain first (most reliable)
    if body.website:
        clean_domain = _clean_domain(body.website)
        domain_result = await db.execute(
            select(Company).where(
                Company.is_active == True,
                Company.website.ilike(f"%{clean_domain}%"),
            ).limit(1)
        )
        existing_by_domain = domain_result.scalar_one_or_none()
        if existing_by_domain:
            stage_str = str(existing_by_domain.deal_stage).replace("DealStage.", "").lower()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "duplicate_domain",
                    "message": f"A company with this domain already exists: {existing_by_domain.name}",
                    "company_id": existing_by_domain.id,
                    "company_name": existing_by_domain.name,
                    "deal_stage": stage_str,
                    "crm_url": f"/companies/{existing_by_domain.id}",
                },
            )

    # Check by name (case-insensitive)
    name_result = await db.execute(
        select(Company).where(
            Company.is_active == True,
            func.lower(Company.name) == body.name.lower().strip(),
        ).limit(1)
    )
    existing_by_name = name_result.scalar_one_or_none()
    if existing_by_name:
        duplicate_warning = f"A company with a similar name already exists: {existing_by_name.name}"

    # ── 2. Build notes string ─────────────────────────────────────────────────
    notes_parts = []
    if body.notes:
        notes_parts.append(body.notes)
    if body.business_type:
        notes_parts.append(f"Business type: {body.business_type}")
    if body.is_franchise:
        notes_parts.append("⚠️ Possible franchise — verify before pursuing.")
    if body.save_for_later:
        notes_parts.append("[Saved for later review via Chrome extension]")
    if body.linkedin_url:
        notes_parts.append(f"LinkedIn: {body.linkedin_url}")
    combined_notes = "\n".join(notes_parts) if notes_parts else None

    # ── 3. Create company ─────────────────────────────────────────────────────
    slug = _make_slug(body.name)
    # Ensure slug uniqueness
    slug_check = await db.execute(
        select(Company).where(Company.slug == slug).limit(1)
    )
    if slug_check.scalar_one_or_none():
        import time
        slug = _make_slug(body.name, str(int(time.time()))[-4:])

    company = Company(
        name=body.name.strip(),
        slug=slug,
        website=body.website,
        industry=body.industry,
        sub_industry=body.sub_industry,
        description=body.description,
        owner_name=body.owner_name,
        owner_email=body.owner_email,
        owner_phone=body.owner_phone,
        city=body.city,
        state=body.state,
        annual_revenue=body.annual_revenue,
        asking_price=body.asking_price,
        employees=body.employees,
        founded_year=body.founded_year,
        lead_partner=body.lead_partner or current_user.username,
        deal_stage=DealStage.PROSPECT,
        source="Direct Web",
        is_proprietary=True,
        is_active=True,
    )
    db.add(company)
    await db.flush()  # get company.id

    # ── 4. Add initial note if provided ──────────────────────────────────────
    if combined_notes:
        from app.models.models import Note
        note = Note(
            company_id=company.id,
            content=combined_notes,
            author_id=current_user.id,
            note_type="general",
        )
        db.add(note)

    # ── 5. Log activity ───────────────────────────────────────────────────────
    from app.models.models import ActivityLog
    log = ActivityLog(
        company_id=company.id,
        user_id=current_user.id,
        actor_name=current_user.display_name or current_user.username,
        action_type="created",
        description=f"Added via Chrome Extension by {current_user.display_name or current_user.username}",
    )
    db.add(log)

    await db.commit()
    await db.refresh(company)

    stage_str = str(company.deal_stage).replace("DealStage.", "").lower()
    return ExtensionCreateOut(
        company_id=company.id,
        company_name=company.name,
        deal_stage=stage_str,
        crm_url=f"/companies/{company.id}",
        duplicate_warning=duplicate_warning,
        is_new=True,
    )
