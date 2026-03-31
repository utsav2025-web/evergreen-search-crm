"""
Enrichment routes — AI-powered company enrichment via Perplexity.

Perplexity's `sonar` model does a live web search and synthesises structured
data about the company, so it works well on small/mid-market private businesses
(HVAC, manufacturing, distribution, etc.) that Clearbit would miss.

Endpoints:
  POST /enrichment/{company_id}/enrich  — enrich a single company (synchronous)
  GET  /enrichment/{company_id}/log     — enrichment history for a company
  GET  /enrichment/{company_id}/score   — enrichment score + field coverage
  GET  /enrichment/settings             — get API key config status
  PUT  /enrichment/settings             — save API keys
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import Company, EnrichmentLog, User

router = APIRouter()

# Fields Perplexity will try to populate, in order of usefulness
ENRICHABLE_FIELDS = [
    "description",
    "industry",
    "sub_industry",
    "employees",
    "founded_year",
    "city",
    "state",
    "annual_revenue",
    "ebitda",
    "owner_name",
    "owner_email",
    "owner_phone",
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_env_path() -> str:
    import pathlib
    return str(pathlib.Path(__file__).parents[4] / ".env")


def _read_env_key(key: str) -> Optional[str]:
    val = os.getenv(key)
    if val:
        return val
    env_path = _get_env_path()
    if os.path.exists(env_path):
        for line in open(env_path):
            line = line.strip()
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip().strip('"').strip("'") or None
    return None


def _write_env_key(key: str, value: str) -> None:
    env_path = _get_env_path()
    lines: list = []
    found = False
    if os.path.exists(env_path):
        with open(env_path) as f:
            lines = f.readlines()
    new_lines: list = []
    for line in lines:
        if line.strip().startswith(f"{key}="):
            new_lines.append(f'{key}="{value}"\n')
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f'{key}="{value}"\n')
    with open(env_path, "w") as f:
        f.writelines(new_lines)
    os.environ[key] = value


def _key_preview(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    return key[:8] + "..." if len(key) > 8 else key[:4] + "..."


def _extract_domain(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = parsed.netloc or parsed.path
    return host.replace("www.", "").split("/")[0].lower() or None


def _compute_enrichment_score(company: Company) -> float:
    """Return 0–100 representing how complete the company record is."""
    fields = [
        company.website, company.industry, company.annual_revenue,
        company.ebitda, company.employees, company.founded_year,
        company.asking_price, company.owner_name, company.owner_email,
        company.owner_phone, company.description, company.city, company.state,
    ]
    filled = sum(1 for f in fields if f is not None)
    return round((filled / len(fields)) * 100, 1)


def _field_coverage(company: Company) -> dict:
    """Return a dict of field → bool indicating which fields are populated."""
    return {
        "website":        company.website is not None,
        "description":    company.description is not None,
        "industry":       company.industry is not None,
        "sub_industry":   getattr(company, "sub_industry", None) is not None,
        "annual_revenue": company.annual_revenue is not None,
        "ebitda":         company.ebitda is not None,
        "employees":      company.employees is not None,
        "founded_year":   company.founded_year is not None,
        "asking_price":   company.asking_price is not None,
        "city":           company.city is not None,
        "state":          company.state is not None,
        "owner_name":     company.owner_name is not None,
        "owner_email":    company.owner_email is not None,
        "owner_phone":    company.owner_phone is not None,
    }


# ─── Perplexity enrichment ────────────────────────────────────────────────────

PERPLEXITY_SYSTEM = (
    "You are a business research assistant. The user will give you a company name "
    "and website. Search the web and return ONLY a valid JSON object — no markdown, "
    "no explanation, no code fences — with these exact keys:\n"
    "  description (string: 1-3 sentence business description),\n"
    "  industry (string: broad industry, e.g. 'HVAC', 'Manufacturing'),\n"
    "  sub_industry (string: more specific, e.g. 'Commercial HVAC'),\n"
    "  employees (integer: headcount, or null),\n"
    "  founded_year (integer: 4-digit year, or null),\n"
    "  city (string: HQ city, or null),\n"
    "  state (string: 2-letter US state code, or null),\n"
    "  annual_revenue (number: USD, e.g. 5000000, or null),\n"
    "  ebitda (number: USD, or null),\n"
    "  owner_name (string: owner/CEO name, or null),\n"
    "  owner_email (string: owner contact email, or null),\n"
    "  owner_phone (string: owner/main phone, or null).\n"
    "Use null for any field you cannot find with reasonable confidence. "
    "Revenue and EBITDA must be numbers (no $ signs, no commas). "
    "Return ONLY the JSON object."
)


async def _perplexity_enrich(
    company_name: str,
    website: Optional[str],
    api_key: str,
) -> tuple[dict, str]:
    """
    Call Perplexity sonar model to research the company.
    Returns (parsed_fields_dict, raw_content_str).
    """
    domain = _extract_domain(website)
    user_msg = f"Company: {company_name}"
    if domain:
        user_msg += f"\nWebsite: {domain}"

    payload = {
        "model": "sonar",
        "messages": [
            {"role": "system", "content": PERPLEXITY_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.1,
        "max_tokens": 512,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences if Perplexity wraps the JSON anyway
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)

        parsed = json.loads(content)
        return parsed, content

    except (json.JSONDecodeError, KeyError, ValueError):
        # Return raw content for debugging even if JSON parse failed
        raw = content if "content" in dir() else ""
        return {}, raw
    except Exception as e:
        return {}, str(e)


def _apply_fields(company: Company, parsed: dict) -> list[str]:
    """
    Write parsed fields onto the company object only where the field is currently
    empty. Returns list of field names that were actually updated.
    """
    updated = []
    type_map = {
        "employees":     int,
        "founded_year":  int,
        "annual_revenue": float,
        "ebitda":        float,
    }
    for field in ENRICHABLE_FIELDS:
        value = parsed.get(field)
        if value is None:
            continue
        # Skip if already populated
        if getattr(company, field, None) is not None:
            continue
        # Type coerce numeric fields
        if field in type_map:
            try:
                value = type_map[field](value)
            except (TypeError, ValueError):
                continue
        # Basic sanity: skip empty strings
        if isinstance(value, str) and not value.strip():
            continue
        try:
            setattr(company, field, value)
            updated.append(field)
        except Exception:
            continue
    return updated


# ─── Pydantic ─────────────────────────────────────────────────────────────────

class EnrichmentSettingsIn(BaseModel):
    perplexity_api_key: Optional[str] = None
    # Legacy fields accepted but ignored (backward compat with old frontend)
    clearbit_api_key: Optional[str] = None
    google_places_api_key: Optional[str] = None


class EnrichmentSettingsOut(BaseModel):
    perplexity_configured: bool
    perplexity_key_preview: Optional[str] = None
    # Kept for backward compat with old frontend code
    clearbit_configured: bool = False
    clearbit_key_preview: Optional[str] = None
    google_places_configured: bool = False
    google_places_key_preview: Optional[str] = None


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/{company_id}/enrich")
async def enrich_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Synchronously enrich a company via Perplexity web search."""
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    api_key = _read_env_key("PERPLEXITY_API_KEY")
    if not api_key:
        return {
            "company_id": company_id,
            "company_name": company.name,
            "sources": [{
                "source": "perplexity",
                "success": False,
                "fields_found": [],
                "fields_actually_updated": [],
                "fields_missing": ENRICHABLE_FIELDS,
                "error_message": "Perplexity API key not configured. Add it in Settings → Enrichment.",
                "duration_ms": 0,
            }],
            "total_fields_filled": 0,
            "enrichment_score": _compute_enrichment_score(company),
        }

    t0 = time.monotonic()
    parsed, raw = await _perplexity_enrich(company.name, company.website, api_key)
    duration_ms = int((time.monotonic() - t0) * 1000)

    fields_found = [f for f in ENRICHABLE_FIELDS if parsed.get(f) is not None]
    updated_fields = _apply_fields(company, parsed)
    fields_missing = [f for f in ENRICHABLE_FIELDS if f not in fields_found]
    success = bool(parsed)

    # Update enrichment score on company
    new_score = _compute_enrichment_score(company)
    company.enrichment_score = new_score

    # Write enrichment log entry
    log_entry = EnrichmentLog(
        company_id=company_id,
        source="perplexity",
        success=success,
        fields_found=updated_fields,
        fields_missing=fields_missing,
        raw_response={"content": raw[:4000]} if raw else {},
        error_message=None if success else (raw[:500] if raw else "Unknown error"),
        duration_ms=duration_ms,
    )
    db.add(log_entry)
    await db.commit()

    return {
        "company_id": company_id,
        "company_name": company.name,
        "sources": [{
            "source": "perplexity",
            "success": success,
            "fields_found": fields_found,
            "fields_actually_updated": updated_fields,
            "fields_missing": fields_missing,
            "error_message": None if success else "Failed to parse Perplexity response",
            "duration_ms": duration_ms,
        }],
        "total_fields_filled": len(updated_fields),
        "enrichment_score": new_score,
    }


@router.get("/{company_id}/log")
async def get_enrichment_log(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return the enrichment run history for a company (newest first)."""
    result = await db.execute(select(Company).where(Company.id == company_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Company not found")

    logs_result = await db.execute(
        select(EnrichmentLog)
        .where(EnrichmentLog.company_id == company_id)
        .order_by(desc(EnrichmentLog.run_at))
        .limit(20)
    )
    logs = logs_result.scalars().all()

    return {
        "company_id": company_id,
        "logs": [
            {
                "id": log.id,
                "source": log.source,
                "run_at": log.run_at.isoformat() if log.run_at else None,
                "success": log.success,
                "fields_found": log.fields_found or [],
                "fields_missing": log.fields_missing or [],
                "error_message": log.error_message,
                "duration_ms": log.duration_ms,
            }
            for log in logs
        ],
    }


@router.get("/{company_id}/score")
async def get_enrichment_score(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return the current enrichment score and field coverage for a company."""
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    return {
        "company_id": company_id,
        "enrichment_score": _compute_enrichment_score(company),
        "field_coverage": _field_coverage(company),
    }


@router.get("/settings", response_model=EnrichmentSettingsOut)
async def get_enrichment_settings(_: User = Depends(get_current_user)):
    key = _read_env_key("PERPLEXITY_API_KEY")
    return {
        "perplexity_configured": bool(key),
        "perplexity_key_preview": _key_preview(key),
        "clearbit_configured": False,
        "clearbit_key_preview": None,
        "google_places_configured": False,
        "google_places_key_preview": None,
    }


@router.put("/settings", response_model=EnrichmentSettingsOut)
async def update_enrichment_settings(
    body: EnrichmentSettingsIn,
    _: User = Depends(get_current_user),
):
    if body.perplexity_api_key is not None:
        _write_env_key("PERPLEXITY_API_KEY", body.perplexity_api_key.strip())
    key = _read_env_key("PERPLEXITY_API_KEY")
    return {
        "perplexity_configured": bool(key),
        "perplexity_key_preview": _key_preview(key),
        "clearbit_configured": False,
        "clearbit_key_preview": None,
        "google_places_configured": False,
        "google_places_key_preview": None,
    }
