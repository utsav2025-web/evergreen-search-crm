"""
Enrichment routes — synchronous domain-based company enrichment.
Uses Clearbit Company API if key is configured; otherwise returns a placeholder.
No background tasks, no polling loops.

Endpoints:
  POST /enrichment/{company_id}   — enrich a single company now (synchronous)
  GET  /enrichment/settings       — get API key config status
  PUT  /enrichment/settings       — save API keys
"""
from __future__ import annotations

import os
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import Company, User

router = APIRouter()


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


# ─── Clearbit enrichment ──────────────────────────────────────────────────────

async def _clearbit_enrich(domain: str, api_key: str) -> dict:
    """Call Clearbit Company API. Returns enriched fields dict or {} on failure."""
    url = f"https://company.clearbit.com/v2/companies/find?domain={domain}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, auth=(api_key, ""))
        if resp.status_code == 200:
            data = resp.json()
            return {
                "description": data.get("description"),
                "industry":    data.get("category", {}).get("industry"),
                "city":        data.get("geo", {}).get("city"),
                "state":       data.get("geo", {}).get("state"),
                "employees":   data.get("metrics", {}).get("employees"),
                "founded_year": data.get("foundedYear"),
            }
    except Exception:
        pass
    return {}


# ─── Pydantic ─────────────────────────────────────────────────────────────────

class EnrichmentSettingsIn(BaseModel):
    clearbit_api_key: Optional[str] = None


class EnrichmentSettingsOut(BaseModel):
    clearbit_configured: bool
    clearbit_key_preview: Optional[str] = None


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/{company_id}")
async def enrich_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Synchronously enrich a company using its domain via Clearbit."""
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    domain = _extract_domain(company.website)
    if not domain:
        return {"ok": False, "message": "No domain available for enrichment", "company_id": company_id}

    clearbit_key = _read_env_key("CLEARBIT_API_KEY")
    enriched: dict = {}

    if clearbit_key:
        enriched = await _clearbit_enrich(domain, clearbit_key)

    updated_fields = []
    for field, value in enriched.items():
        if value and not getattr(company, field, None):
            setattr(company, field, value)
            updated_fields.append(field)

    if updated_fields:
        await db.commit()

    if not clearbit_key:
        msg = "Clearbit API key not configured. Add it in Settings → Enrichment to enable."
    elif updated_fields:
        msg = f"Enriched {len(updated_fields)} field(s) via Clearbit."
    else:
        msg = "No new fields found — company may already be fully enriched."

    return {
        "ok": True,
        "company_id": company_id,
        "domain": domain,
        "enriched_fields": updated_fields,
        "source": "clearbit" if clearbit_key else "none",
        "message": msg,
    }


@router.get("/settings", response_model=EnrichmentSettingsOut)
async def get_enrichment_settings(_: User = Depends(get_current_user)):
    cb_key = _read_env_key("CLEARBIT_API_KEY")
    return {"clearbit_configured": bool(cb_key), "clearbit_key_preview": _key_preview(cb_key)}


@router.put("/settings", response_model=EnrichmentSettingsOut)
async def update_enrichment_settings(
    body: EnrichmentSettingsIn,
    _: User = Depends(get_current_user),
):
    if body.clearbit_api_key is not None:
        _write_env_key("CLEARBIT_API_KEY", body.clearbit_api_key.strip())
    cb_key = _read_env_key("CLEARBIT_API_KEY")
    return {"clearbit_configured": bool(cb_key), "clearbit_key_preview": _key_preview(cb_key)}
