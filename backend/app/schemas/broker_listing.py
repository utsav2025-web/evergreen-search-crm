"""
Pydantic schemas for the BrokerListing model.

Spec fields covered
-------------------
id, broker_site, listing_id, listing_url, business_name,
asking_price, revenue, ebitda, location, industry, description,
date_listed, date_scraped, matched_company_id, is_new, raw_text
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# Shared base
# ─────────────────────────────────────────────────────────────────────────────

class BrokerListingBase(BaseModel):
    # Spec: broker_site
    broker_site: str = Field(..., max_length=50,
                             description="bizbuysell | axial | bizquest | dealstream")
    # Spec: listing_id  (external ID on the source site)
    listing_id: Optional[str] = Field(None, max_length=255)
    # Spec: listing_url
    listing_url: Optional[str] = Field(None, max_length=1000)
    # Spec: business_name
    business_name: Optional[str] = Field(None, max_length=500)
    # Spec: asking_price
    asking_price: Optional[float] = Field(None, ge=0)
    # Spec: revenue
    revenue: Optional[float] = Field(None, ge=0)
    # Spec: ebitda
    ebitda: Optional[float] = None
    cash_flow: Optional[float] = None
    # Spec: location
    location: Optional[str] = Field(None, max_length=200)
    # Spec: industry
    industry: Optional[str] = Field(None, max_length=100)
    # Spec: description
    description: Optional[str] = None
    # Spec: date_listed
    date_listed: Optional[datetime] = None
    # Spec: matched_company_id
    matched_company_id: Optional[int] = None
    # Spec: is_new
    is_new: bool = True
    # Spec: raw_text
    raw_text: Optional[str] = None

    # Geographic breakdown
    city: Optional[str] = Field(None, max_length=200)
    state: Optional[str] = Field(None, max_length=50)
    country: Optional[str] = Field(None, max_length=100)
    # Business details
    employees: Optional[int] = None
    years_in_business: Optional[int] = None
    sba_eligible: Optional[bool] = None
    # Acquisition classification
    acquisition_tag: Optional[str] = Field(None, max_length=30,
                                            description="platform | bolt_on | owner_operator | unknown")
    industry_priority: Optional[str] = Field(None, max_length=20,
                                              description="priority | non_priority | unknown")
    # Status (new | reviewed | interested | passed | matched)
    status: Optional[str] = Field(None, max_length=30)
    # Additional broker contact fields
    broker_id: Optional[int] = None
    broker_name: Optional[str] = Field(None, max_length=200)
    broker_email: Optional[str] = Field(None, max_length=255)
    broker_phone: Optional[str] = Field(None, max_length=50)
    raw_data: Dict[str, Any] = Field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

class BrokerListingCreate(BrokerListingBase):
    """Payload for POST /broker-listings/ (typically from the scraper)."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

class BrokerListingUpdate(BaseModel):
    """Payload for PATCH /broker-listings/{id}"""
    business_name: Optional[str] = None
    asking_price: Optional[float] = None
    revenue: Optional[float] = None
    ebitda: Optional[float] = None
    cash_flow: Optional[float] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    date_listed: Optional[datetime] = None
    matched_company_id: Optional[int] = None
    is_new: Optional[bool] = None
    employees: Optional[int] = None
    years_in_business: Optional[int] = None
    sba_eligible: Optional[bool] = None
    acquisition_tag: Optional[str] = None
    industry_priority: Optional[str] = None
    status: Optional[str] = None
    broker_id: Optional[int] = None
    broker_name: Optional[str] = None
    broker_email: Optional[str] = None
    broker_phone: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

class BrokerListingOut(BrokerListingBase):
    """Full listing record returned from the API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Spec: date_scraped
    date_scraped: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class BrokerListingListOut(BaseModel):
    """Paginated list response."""
    total: int
    items: List[BrokerListingOut]
