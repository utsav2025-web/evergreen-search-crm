"""
Broker Listings CRUD routes.

Endpoints
---------
GET    /broker-listings/             List + filter listings
POST   /broker-listings/             Create listing (manual or from scraper)
GET    /broker-listings/stats/summary  Aggregate stats
GET    /broker-listings/{id}         Get listing detail
PATCH  /broker-listings/{id}         Update listing
DELETE /broker-listings/{id}         Soft-delete
POST   /broker-listings/{id}/match   Match listing to an existing company
POST   /broker-listings/{id}/review  Mark listing as reviewed (is_new=False)
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, Pagination
from app.models.models import BrokerListing, Company, User
from app.schemas.broker_listing import (
    BrokerListingCreate, BrokerListingUpdate, BrokerListingOut, BrokerListingListOut,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Stats  (placed before /{id} to avoid route shadowing)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stats/summary")
async def listing_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return aggregate stats about broker listings."""
    total = (await db.execute(
        select(func.count()).where(BrokerListing.is_active == True)
    )).scalar() or 0
    new_count = (await db.execute(
        select(func.count()).where(
            BrokerListing.is_active == True,
            BrokerListing.is_new == True,
        )
    )).scalar() or 0
    matched_count = (await db.execute(
        select(func.count()).where(
            BrokerListing.is_active == True,
            BrokerListing.matched_company_id.isnot(None),
        )
    )).scalar() or 0

    return {
        "total": total,
        "new_unreviewed": new_count,
        "matched_to_company": matched_count,
        "unmatched": total - matched_count,
    }


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=BrokerListingListOut)
async def list_broker_listings(
    broker_site: Optional[str] = Query(None,
                                       description="bizbuysell | axial | bizquest | dealstream"),
    industry: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    state: Optional[str] = Query(None, description="Filter by US state abbreviation"),
    is_new: Optional[bool] = Query(None, description="Filter to unreviewed listings"),
    matched: Optional[bool] = Query(None, description="True = has matched company"),
    status: Optional[str] = Query(None, description="new | reviewed | interested | passed | matched"),
    acquisition_tag: Optional[str] = Query(None,
                                           description="platform | bolt_on | owner_operator | unknown"),
    industry_priority: Optional[str] = Query(None, description="priority | non_priority | unknown"),
    min_asking: Optional[float] = Query(None, ge=0),
    max_asking: Optional[float] = Query(None),
    min_revenue: Optional[float] = Query(None, ge=0),
    min_ebitda: Optional[float] = Query(None),
    search: Optional[str] = Query(None, description="Search business_name"),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a paginated, filterable list of broker listings."""
    q = select(BrokerListing).where(BrokerListing.is_active == True)

    if broker_site:
        q = q.where(BrokerListing.broker_site == broker_site)
    if industry:
        q = q.where(BrokerListing.industry.ilike(f"%{industry}%"))
    if location:
        q = q.where(BrokerListing.location.ilike(f"%{location}%"))
    if state:
        q = q.where(BrokerListing.state.ilike(f"%{state}%"))
    if is_new is not None:
        q = q.where(BrokerListing.is_new == is_new)
    if matched is True:
        q = q.where(BrokerListing.matched_company_id.isnot(None))
    elif matched is False:
        q = q.where(BrokerListing.matched_company_id.is_(None))
    if status:
        # status is stored in raw_data or as a virtual field; map to is_new for now
        if status == "new":
            q = q.where(BrokerListing.is_new == True)
        elif status == "matched":
            q = q.where(BrokerListing.matched_company_id.isnot(None))
    if acquisition_tag:
        q = q.where(BrokerListing.acquisition_tag == acquisition_tag)
    if industry_priority:
        q = q.where(BrokerListing.industry_priority == industry_priority)
    if min_asking is not None:
        q = q.where(BrokerListing.asking_price >= min_asking)
    if max_asking is not None:
        q = q.where(BrokerListing.asking_price <= max_asking)
    if min_revenue is not None:
        q = q.where(BrokerListing.revenue >= min_revenue)
    if min_ebitda is not None:
        q = q.where(BrokerListing.ebitda >= min_ebitda)
    if search:
        q = q.where(BrokerListing.business_name.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = (q.order_by(BrokerListing.date_scraped.desc())
          .offset(pagination.skip)
          .limit(pagination.limit))
    listings = (await db.execute(q)).scalars().all()

    return BrokerListingListOut(
        total=total,
        items=[BrokerListingOut.model_validate(lst) for lst in listings],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=BrokerListingOut, status_code=status.HTTP_201_CREATED)
async def create_broker_listing(
    body: BrokerListingCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create a broker listing record (upsert by broker_site + listing_id)."""
    # Upsert: if listing already exists by (broker_site, listing_id), update it
    if body.listing_id:
        existing_q = await db.execute(
            select(BrokerListing).where(
                BrokerListing.broker_site == body.broker_site,
                BrokerListing.listing_id == body.listing_id,
            )
        )
        existing = existing_q.scalar_one_or_none()
        if existing:
            for field, value in body.model_dump(exclude_unset=True).items():
                setattr(existing, field, value)
            await db.commit()
            await db.refresh(existing)
            return BrokerListingOut.model_validate(existing)

    listing = BrokerListing(**body.model_dump())
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return BrokerListingOut.model_validate(listing)


# ─────────────────────────────────────────────────────────────────────────────
# Get one
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{listing_id}", response_model=BrokerListingOut)
async def get_broker_listing(
    listing_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BrokerListing).where(
            BrokerListing.id == listing_id,
            BrokerListing.is_active == True,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return BrokerListingOut.model_validate(listing)


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{listing_id}", response_model=BrokerListingOut)
async def update_broker_listing(
    listing_id: int,
    body: BrokerListingUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BrokerListing).where(BrokerListing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(listing, field, value)
    await db.commit()
    await db.refresh(listing)
    return BrokerListingOut.model_validate(listing)


# ─────────────────────────────────────────────────────────────────────────────
# Delete (soft)
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_broker_listing(
    listing_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BrokerListing).where(BrokerListing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.is_active = False
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Match to company
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{listing_id}/match", response_model=BrokerListingOut)
async def match_listing_to_company(
    listing_id: int,
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Link a broker listing to an existing company record."""
    listing_q = await db.execute(
        select(BrokerListing).where(BrokerListing.id == listing_id)
    )
    listing = listing_q.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    company_q = await db.execute(
        select(Company).where(Company.id == company_id, Company.is_active == True)
    )
    company = company_q.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    listing.matched_company_id = company_id
    listing.is_new = False

    # Copy source traceability fields to the Company record
    if listing.listing_url and not company.listing_url:
        company.listing_url = listing.listing_url
    if listing.listing_url and not company.source_url:
        company.source_url = listing.listing_url
    # Always record which broker listing this came from
    company.broker_listing_ref_id = listing.id
    # If this listing originated from an email ingest, link that too
    raw_data = listing.raw_data or {}
    email_id = raw_data.get("inbound_email_id")
    if email_id and not company.inbound_email_id:
        company.inbound_email_id = int(email_id)

    await db.commit()
    await db.refresh(listing)
    return BrokerListingOut.model_validate(listing)


# ─────────────────────────────────────────────────────────────────────────────
# Mark as reviewed
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{listing_id}/review", response_model=BrokerListingOut)
async def mark_listing_reviewed(
    listing_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Mark a listing as reviewed (clears the is_new flag)."""
    result = await db.execute(
        select(BrokerListing).where(BrokerListing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.is_new = False
    await db.commit()
    await db.refresh(listing)
    return BrokerListingOut.model_validate(listing)
