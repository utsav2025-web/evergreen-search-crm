"""Pydantic schemas for ScraperConfig and ScraperRunLog."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# ScraperConfig schemas
# ─────────────────────────────────────────────────────────────────────────────

class ScraperConfigUpdate(BaseModel):
    """All fields are optional — PATCH semantics."""
    site_enabled:            Optional[dict[str, bool]] = None
    min_revenue:             Optional[float] = None
    max_revenue:             Optional[float] = None
    min_asking_price:        Optional[float] = None
    max_asking_price:        Optional[float] = None
    min_ebitda:              Optional[float] = None
    max_ebitda:              Optional[float] = None
    industries_include:      Optional[list[str]] = None
    industries_exclude:      Optional[list[str]] = None
    geo_states:              Optional[list[str]] = None
    keywords_include:        Optional[str] = None
    keywords_exclude:        Optional[str] = None
    run_schedule:            Optional[str] = Field(
        None,
        description="6h | 12h | daily | weekly | manual",
    )
    max_listings_per_site:   Optional[int] = Field(None, ge=1, le=500)
    request_delay_seconds:   Optional[float] = Field(None, ge=1.0, le=30.0)
    max_pages_per_site:      Optional[int] = Field(None, ge=1, le=100)
    rotate_user_agents:      Optional[bool] = None
    respect_robots_txt:      Optional[bool] = None
    fuzzy_match_threshold:   Optional[float] = Field(None, ge=0.5, le=1.0)
    auto_link_matches:       Optional[bool] = None
    cross_site_dedup:        Optional[bool] = None
    notify_new_listings:     Optional[bool] = None
    notify_min_asking_price: Optional[float] = None
    notify_min_revenue:      Optional[float] = None


class ScraperConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                      int
    site_enabled:            Optional[dict[str, bool]] = None
    min_revenue:             Optional[float] = None
    max_revenue:             Optional[float] = None
    min_asking_price:        Optional[float] = None
    max_asking_price:        Optional[float] = None
    min_ebitda:              Optional[float] = None
    max_ebitda:              Optional[float] = None
    industries_include:      Optional[list[str]] = None
    industries_exclude:      Optional[list[str]] = None
    geo_states:              Optional[list[str]] = None
    keywords_include:        Optional[str] = None
    keywords_exclude:        Optional[str] = None
    run_schedule:            Optional[str] = None
    max_listings_per_site:   Optional[int] = None
    request_delay_seconds:   Optional[float] = None
    max_pages_per_site:      Optional[int] = None
    rotate_user_agents:      Optional[bool] = None
    respect_robots_txt:      Optional[bool] = None
    fuzzy_match_threshold:   Optional[float] = None
    auto_link_matches:       Optional[bool] = None
    cross_site_dedup:        Optional[bool] = None
    notify_new_listings:     Optional[bool] = None
    notify_min_asking_price: Optional[float] = None
    notify_min_revenue:      Optional[float] = None
    created_at:              Optional[datetime] = None
    updated_at:              Optional[datetime] = None


# ─────────────────────────────────────────────────────────────────────────────
# ScraperRunLog schemas
# ─────────────────────────────────────────────────────────────────────────────

class ScraperRunLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               int
    config_id:        Optional[int] = None
    run_type:         Optional[str] = None
    status:           Optional[str] = None
    started_at:       Optional[datetime] = None
    finished_at:      Optional[datetime] = None
    duration_seconds: Optional[float] = None
    sites_run:        Optional[int] = None
    pages_scraped:    Optional[int] = None
    listings_found:   Optional[int] = None
    listings_new:     Optional[int] = None
    listings_dupes:   Optional[int] = None
    errors:           Optional[int] = None
    per_site_stats:   Optional[dict[str, Any]] = None
    celery_task_id:   Optional[str] = None
    error_log:        Optional[str] = None
    created_at:       Optional[datetime] = None


# ─────────────────────────────────────────────────────────────────────────────
# Site registry response schema
# ─────────────────────────────────────────────────────────────────────────────

class SiteInfo(BaseModel):
    key:             str
    name:            str
    url:             str
    category:        str
    renderer:        str
    enabled_default: bool
    notes:           str = ""
    enabled:         bool = False   # populated from ScraperConfig.site_enabled


class SitesByCategory(BaseModel):
    category:       str
    label:          str
    sites:          list[SiteInfo]


# ─────────────────────────────────────────────────────────────────────────────
# Scrape run request schema
# ─────────────────────────────────────────────────────────────────────────────

class ScrapeRunRequest(BaseModel):
    site_keys: Optional[list[str]] = Field(
        None,
        description="List of site keys to scrape. If null, scrapes all enabled sites.",
    )
