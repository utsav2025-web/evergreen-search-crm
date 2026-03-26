"""
Pydantic schemas for the Company model.

Spec fields covered
-------------------
id, name, website, industry, sub_industry, annual_revenue,
ebitda, ebitda_margin, employees, founded_year,
state_of_incorporation, entity_type, asking_price,
implied_multiple, deal_stage, source, broker_id, listing_url,
owner_name, owner_email, owner_phone, lead_partner, deal_score,
enrichment_score, created_at, updated_at, last_contacted_at,
is_proprietary
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.models import DealStage, EntityType


# ─────────────────────────────────────────────────────────────────────────────
# Shared base — all writable fields
# ─────────────────────────────────────────────────────────────────────────────

class CompanyBase(BaseModel):
    # ── Identity ─────────────────────────────────────────────────────────────
    name: str = Field(..., min_length=1, max_length=255,
                      description="Legal or trade name of the business")
    website: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None

    # ── Industry ─────────────────────────────────────────────────────────────
    industry: Optional[str] = Field(None, max_length=100)
    sub_industry: Optional[str] = Field(None, max_length=100)

    # ── Financials (spec: annual_revenue, ebitda, ebitda_margin) ─────────────
    annual_revenue: Optional[float] = Field(None, ge=0,
                                            description="TTM revenue in USD")
    ebitda: Optional[float] = Field(None,
                                    description="TTM EBITDA in USD")
    ebitda_margin: Optional[float] = Field(None, ge=0.0, le=1.0,
                                           description="EBITDA / Revenue (0–1 decimal)")
    gross_margin: Optional[float] = Field(None, ge=0.0, le=1.0)
    sde_ttm: Optional[float] = Field(None,
                                     description="Seller's Discretionary Earnings TTM")

    # ── Deal economics ────────────────────────────────────────────────────────
    asking_price: Optional[float] = Field(None, ge=0,
                                          description="Seller's asking price in USD")
    implied_multiple: Optional[float] = Field(None, ge=0,
                                              description="EV / EBITDA implied multiple")

    # ── Company profile ───────────────────────────────────────────────────────
    employees: Optional[int] = Field(None, ge=0,
                                     description="Full-time equivalent headcount")
    founded_year: Optional[int] = Field(None, ge=1800, le=2100)
    state_of_incorporation: Optional[str] = Field(None, max_length=50)
    entity_type: Optional[EntityType] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=50)
    country: str = Field("USA", max_length=50)

    # ── Pipeline ─────────────────────────────────────────────────────────────
    deal_stage: DealStage = Field(DealStage.PROSPECT,
                                  description="Current pipeline stage")

    # ── Sourcing ──────────────────────────────────────────────────────────────
    source: Optional[str] = Field(None, max_length=100,
                                  description="bizbuysell | axial | direct | referral …")
    broker_id: Optional[int] = None
    listing_url: Optional[str] = Field(None, max_length=1000)
    is_proprietary: bool = Field(False,
                                 description="True if off-market / direct-sourced deal")

    # ── Owner contact ─────────────────────────────────────────────────────────
    owner_name: Optional[str] = Field(None, max_length=200)
    owner_email: Optional[str] = Field(None, max_length=255)
    owner_phone: Optional[str] = Field(None, max_length=50)

    # ── Team ──────────────────────────────────────────────────────────────────
    lead_partner: Optional[str] = Field(None, max_length=50,
                                        description="matt | utsav | both")

    # ── Scoring ───────────────────────────────────────────────────────────────
    deal_score: Optional[float] = Field(None, ge=0, le=100,
                                        description="Manual or AI deal quality score")
    enrichment_score: Optional[float] = Field(None, ge=0, le=100,
                                              description="Record completeness score")

    # ── Enrichment IDs ────────────────────────────────────────────────────────
    ein: Optional[str] = Field(None, max_length=20)
    edgar_cik: Optional[str] = Field(None, max_length=20)
    opencorporates_id: Optional[str] = Field(None, max_length=100)
    google_place_id: Optional[str] = Field(None, max_length=100)
    linkedin_url: Optional[str] = Field(None, max_length=500)

    # ── Metadata ──────────────────────────────────────────────────────────────
    tags: List[str] = Field(default_factory=list)

    @field_validator("lead_partner")
    @classmethod
    def validate_lead_partner(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("matt", "utsav", "both"):
            raise ValueError("lead_partner must be 'matt', 'utsav', or 'both'")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

class CompanyCreate(CompanyBase):
    """Payload for POST /companies/"""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Update  (all fields optional for PATCH semantics)
# ─────────────────────────────────────────────────────────────────────────────

class CompanyUpdate(BaseModel):
    """Payload for PATCH /companies/{id} — every field is optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    website: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    sub_industry: Optional[str] = None
    annual_revenue: Optional[float] = None
    ebitda: Optional[float] = None
    ebitda_margin: Optional[float] = Field(None, ge=0.0, le=1.0)
    gross_margin: Optional[float] = Field(None, ge=0.0, le=1.0)
    sde_ttm: Optional[float] = None
    asking_price: Optional[float] = None
    implied_multiple: Optional[float] = None
    employees: Optional[int] = None
    founded_year: Optional[int] = None
    state_of_incorporation: Optional[str] = None
    entity_type: Optional[EntityType] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    deal_stage: Optional[DealStage] = None
    source: Optional[str] = None
    broker_id: Optional[int] = None
    listing_url: Optional[str] = None
    is_proprietary: Optional[bool] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_phone: Optional[str] = None
    lead_partner: Optional[str] = None
    deal_score: Optional[float] = Field(None, ge=0, le=100)
    enrichment_score: Optional[float] = Field(None, ge=0, le=100)
    ein: Optional[str] = None
    edgar_cik: Optional[str] = None
    opencorporates_id: Optional[str] = None
    google_place_id: Optional[str] = None
    linkedin_url: Optional[str] = None
    tags: Optional[List[str]] = None
    last_contacted_at: Optional[datetime] = None
    ai_score: Optional[float] = Field(None, ge=0, le=100)
    ai_score_rationale: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Output  (read from DB)
# ─────────────────────────────────────────────────────────────────────────────

class CompanyOut(CompanyBase):
    """Full company record returned from the API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    # Spec: last_contacted_at
    last_contacted_at: Optional[datetime] = None
    # Spec: created_at, updated_at  (from TimestampMixin)
    created_at: datetime
    updated_at: datetime
    # AI scoring
    ai_score: Optional[float] = None
    ai_score_rationale: Optional[str] = None
    is_active: bool = True
    # Source traceability
    source_url: Optional[str] = None
    inbound_email_id: Optional[int] = None
    broker_listing_ref_id: Optional[int] = None
    thesis_score: Optional[float] = None
    thesis_flags: Optional[Union[List[str], str]] = None
    stage_entered_at: Optional[datetime] = None


class CompanySummary(BaseModel):
    """Lightweight summary used in list views and dropdowns."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    industry: Optional[str] = None
    deal_stage: DealStage
    asking_price: Optional[float] = None
    annual_revenue: Optional[float] = None
    ebitda: Optional[float] = None
    lead_partner: Optional[str] = None
    deal_score: Optional[float] = None
    is_proprietary: bool = False
    created_at: datetime


class CompanyListOut(BaseModel):
    """Paginated list response."""
    total: int
    items: List[CompanySummary]
