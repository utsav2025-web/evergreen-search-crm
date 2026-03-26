"""
Companies CRUD routes.

Endpoints
---------
GET    /companies/                  List + filter companies
POST   /companies/                  Create company
GET    /companies/{id}              Get company detail
PATCH  /companies/{id}              Update company fields
DELETE /companies/{id}              Soft-delete (is_active=False)
GET    /companies/{id}/notes        List notes for a company
GET    /companies/{id}/outreach     List outreach log for a company
GET    /companies/{id}/documents    List documents for a company
POST   /companies/{id}/stage        Move company to a new deal stage
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, Pagination
from app.models.models import Company, Deal, DealStage, Note, OutreachLog, Document, User
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyOut, CompanySummary, CompanyListOut,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_slug(name: str, suffix: str = "") -> str:
    """Generate a URL-safe slug from a company name."""
    try:
        from python_slugify import slugify
        base = slugify(name)
    except ImportError:
        import re
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{base}-{suffix}" if suffix else base


def _compute_enrichment_score(company: Company) -> float:
    """
    Calculate how complete a company record is (0–100).
    Each populated field contributes points.
    """
    fields = [
        company.website, company.industry, company.annual_revenue,
        company.ebitda, company.employees, company.founded_year,
        company.state_of_incorporation, company.entity_type,
        company.asking_price, company.owner_name, company.owner_email,
        company.owner_phone, company.lead_partner, company.description,
        company.city, company.state,
    ]
    filled = sum(1 for f in fields if f is not None)
    return round((filled / len(fields)) * 100, 1)


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=CompanyListOut)
async def list_companies(
    search: Optional[str] = Query(None, description="Full-text search on name"),
    industry: Optional[str] = Query(None),
    sub_industry: Optional[str] = Query(None),
    state: Optional[str] = Query(None, description="US state abbreviation"),
    deal_stage: Optional[DealStage] = Query(None),
    source: Optional[str] = Query(None),
    lead_partner: Optional[str] = Query(None, description="matt | utsav | both"),
    is_proprietary: Optional[bool] = Query(None),
    min_revenue: Optional[float] = Query(None, ge=0),
    max_revenue: Optional[float] = Query(None),
    min_ebitda: Optional[float] = Query(None),
    max_asking_price: Optional[float] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a paginated, filterable list of companies."""
    q = select(Company).where(Company.is_active == True)

    if search:
        q = q.where(Company.name.ilike(f"%{search}%"))
    if industry:
        q = q.where(Company.industry == industry)
    if sub_industry:
        q = q.where(Company.sub_industry == sub_industry)
    if state:
        q = q.where(Company.state == state)
    if deal_stage:
        q = q.where(Company.deal_stage == deal_stage)
    if source:
        q = q.where(Company.source == source)
    if lead_partner:
        q = q.where(Company.lead_partner == lead_partner)
    if is_proprietary is not None:
        q = q.where(Company.is_proprietary == is_proprietary)
    if min_revenue is not None:
        q = q.where(Company.annual_revenue >= min_revenue)
    if max_revenue is not None:
        q = q.where(Company.annual_revenue <= max_revenue)
    if min_ebitda is not None:
        q = q.where(Company.ebitda >= min_ebitda)
    if max_asking_price is not None:
        q = q.where(Company.asking_price <= max_asking_price)

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    q = q.order_by(Company.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    result = await db.execute(q)
    companies = result.scalars().all()

    return CompanyListOut(
        total=total,
        items=[CompanySummary.model_validate(c) for c in companies],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(
    body: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new company record."""
    # Generate unique slug
    slug = _make_slug(body.name)
    existing = await db.execute(select(Company).where(Company.slug == slug))
    if existing.scalar_one_or_none():
        slug = _make_slug(body.name, str(int(datetime.now(timezone.utc).timestamp())))

    data = body.model_dump()
    company = Company(**data, slug=slug)

    # Sync alias fields so both column names are populated
    if company.annual_revenue and not company.revenue_ttm:
        company.revenue_ttm = company.annual_revenue
    if company.ebitda and not company.ebitda_ttm:
        company.ebitda_ttm = company.ebitda
    if company.employees and not company.employee_count:
        company.employee_count = company.employees
    if company.founded_year and not company.year_founded:
        company.year_founded = company.founded_year
    if company.listing_url and not company.source_url:
        company.source_url = company.listing_url

    # Auto-compute enrichment score
    company.enrichment_score = _compute_enrichment_score(company)

    db.add(company)
    await db.commit()
    await db.refresh(company)
    return CompanyOut.model_validate(company)


# ─────────────────────────────────────────────────────────────────────────────
# Get one
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a single company by ID."""
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.is_active == True)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return CompanyOut.model_validate(company)


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: int,
    body: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Partially update a company record (PATCH semantics)."""
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.is_active == True)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(company, field, value)

    # Keep alias fields in sync
    if "annual_revenue" in updates:
        company.revenue_ttm = updates["annual_revenue"]
    if "ebitda" in updates:
        company.ebitda_ttm = updates["ebitda"]
    if "employees" in updates:
        company.employee_count = updates["employees"]
    if "founded_year" in updates:
        company.year_founded = updates["founded_year"]
    if "listing_url" in updates:
        company.source_url = updates["listing_url"]

    # Recompute enrichment score
    company.enrichment_score = _compute_enrichment_score(company)

    await db.commit()
    await db.refresh(company)
    return CompanyOut.model_validate(company)


# ─────────────────────────────────────────────────────────────────────────────
# Delete (soft)
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Soft-delete a company (sets is_active=False)."""
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.is_active == True)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.is_active = False
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Stage move
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{company_id}/stage", response_model=CompanyOut)
async def move_stage(
    company_id: int,
    new_stage: DealStage,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Move a company to a new deal stage."""
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.is_active == True)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.deal_stage = new_stage
    company.stage_entered_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(company)
    return CompanyOut.model_validate(company)


# ─────────────────────────────────────────────────────────────────────────────
# Sub-resource: notes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{company_id}/notes", response_model=dict)
async def list_company_notes(
    company_id: int,
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all notes for a company, newest first."""
    q = select(Note).where(Note.company_id == company_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(Note.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    notes = (await db.execute(q)).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": n.id,
                "content": n.content,
                "note_type": n.note_type,
                "tagged_stage": n.tagged_stage,
                "is_pinned": n.is_pinned,
                "author_id": n.author_id,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sub-resource: outreach
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{company_id}/outreach", response_model=dict)
async def list_company_outreach(
    company_id: int,
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all outreach log entries for a company."""
    q = select(OutreachLog).where(OutreachLog.company_id == company_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(OutreachLog.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    logs = (await db.execute(q)).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": ol.id,
                "contact_method": ol.contact_method,
                "direction": ol.direction,
                "outcome": ol.outcome,
                "notes": ol.notes,
                "follow_up_date": ol.follow_up_date.isoformat() if ol.follow_up_date else None,
                "sent_by": ol.sent_by,
                "created_at": ol.created_at.isoformat() if ol.created_at else None,
            }
            for ol in logs
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sub-resource: documents
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{company_id}/documents", response_model=dict)
async def list_company_documents(
    company_id: int,
    doc_type: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all documents for a company."""
    q = select(Document).where(Document.company_id == company_id)
    if doc_type:
        q = q.where(Document.doc_type == doc_type)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(Document.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    docs = (await db.execute(q)).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": d.id,
                "doc_type": d.doc_type,
                "filename": d.filename,
                "file_path": d.file_path,
                "file_size_bytes": d.file_size_bytes,
                "mime_type": d.mime_type,
                "uploaded_by": d.uploaded_by,
                "is_confidential": d.is_confidential,
                "version": d.version,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ],
    }
