"""
Bulk CSV / Excel Import API
===========================
POST /api/import/csv          — upload a CSV or Excel (.xlsx/.xls) file and create Company records
GET  /api/import/jobs         — list import jobs
GET  /api/import/jobs/{id}    — get job status
GET  /api/import/template     — download the CSV template

Expected columns (flexible — mapped by header name):
  name, website, industry, sub_industry, annual_revenue, ebitda,
  ebitda_margin, asking_price, employees, founded_year,
  city, state, owner_name, owner_email, owner_phone,
  source, description, linkedin_url, tags
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import Company, DealStage, ImportJob, ThesisConfig, User
from app.scoring.thesis_scorer import score_company

try:
    import openpyxl
    _XLSX_AVAILABLE = True
except ImportError:
    _XLSX_AVAILABLE = False

router = APIRouter(tags=["import"])

# ─────────────────────────────────────────────────────────────────────────────
# Column mapping — maps header variants to canonical field names
# ─────────────────────────────────────────────────────────────────────────────

COLUMN_MAP: dict[str, str] = {
    # Name
    "name": "name", "company name": "name", "company_name": "name",
    "business name": "name", "business_name": "name",
    # Website
    "website": "website", "url": "website", "web": "website",
    # Industry
    "industry": "industry", "sector": "industry",
    "sub_industry": "sub_industry", "sub industry": "sub_industry",
    # Financials
    "revenue": "annual_revenue", "annual_revenue": "annual_revenue",
    "annual revenue": "annual_revenue", "revenue_ttm": "annual_revenue",
    "ebitda": "ebitda", "ebitda_ttm": "ebitda",
    "ebitda_margin": "ebitda_margin", "ebitda margin": "ebitda_margin",
    "asking_price": "asking_price", "asking price": "asking_price",
    "ask": "asking_price", "list price": "asking_price",
    "sde": "sde_ttm", "sde_ttm": "sde_ttm", "cash flow": "sde_ttm",
    # Profile
    "employees": "employees", "employee_count": "employees",
    "headcount": "employees", "staff": "employees",
    "founded_year": "founded_year", "founded year": "founded_year",
    "year founded": "founded_year", "established": "founded_year",
    # Location
    "city": "city", "state": "state", "location": "city",
    # Owner
    "owner_name": "owner_name", "owner name": "owner_name",
    "owner": "owner_name", "seller": "owner_name",
    "owner_email": "owner_email", "owner email": "owner_email",
    "owner_phone": "owner_phone", "owner phone": "owner_phone",
    "phone": "owner_phone",
    # Sourcing
    "source": "source", "channel": "source",
    "description": "description", "notes": "description",
    "linkedin_url": "linkedin_url", "linkedin": "linkedin_url",
    "tags": "tags",
}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_float(val: str) -> Optional[float]:
    if not val or str(val).strip() in ("", "-", "N/A", "n/a", "NA"):
        return None
    cleaned = re.sub(r"[$,\s]", "", str(val).strip())
    if cleaned.upper().endswith("M"):
        try:
            return float(cleaned[:-1]) * 1_000_000
        except ValueError:
            pass
    if cleaned.upper().endswith("K"):
        try:
            return float(cleaned[:-1]) * 1_000
        except ValueError:
            pass
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_int(val: str) -> Optional[int]:
    f = _parse_float(val)
    return int(f) if f is not None else None


def _make_slug(name: str, existing_slugs: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80]
    slug = base
    counter = 1
    while slug in existing_slugs:
        slug = f"{base}-{counter}"
        counter += 1
    existing_slugs.add(slug)
    return slug


def _parse_file_to_rows(filename: str, content: bytes) -> list[dict]:
    """Parse CSV or Excel bytes into a list of row dicts."""
    fname = (filename or "").lower()

    if fname.endswith(".xlsx") or fname.endswith(".xls"):
        if not _XLSX_AVAILABLE:
            raise HTTPException(
                400,
                "Excel support requires openpyxl. Please upload a CSV instead, "
                "or contact your admin to install openpyxl."
            )
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        all_rows = list(ws.iter_rows(values_only=True))
        if not all_rows:
            raise HTTPException(400, "Excel file is empty")
        # First non-empty row = headers
        headers = [str(h).strip() if h is not None else f"col_{i}" for i, h in enumerate(all_rows[0])]
        result = []
        for row in all_rows[1:]:
            if all(v is None or str(v).strip() == "" for v in row):
                continue  # skip blank rows
            result.append({
                headers[i]: (str(row[i]).strip() if row[i] is not None else "")
                for i in range(len(headers))
            })
        return result

    # CSV
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(400, "CSV has no headers")
    return list(reader)


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/template")
async def download_template():
    """Return a CSV template file."""
    headers = [
        "name", "website", "industry", "sub_industry",
        "annual_revenue", "ebitda", "ebitda_margin", "asking_price",
        "employees", "founded_year", "city", "state",
        "owner_name", "owner_email", "owner_phone",
        "source", "description", "linkedin_url", "tags",
    ]
    example = [
        "Acme HVAC Services", "https://acmehvac.com", "HVAC", "Commercial HVAC",
        "5000000", "900000", "0.18", "4500000",
        "32", "2008", "Austin", "TX",
        "John Smith", "john@acmehvac.com", "512-555-0100",
        "csv_import", "Established HVAC company with strong recurring contracts", "", "hvac,texas",
    ]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerow(example)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=evergreen_import_template.csv"},
    )


@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    source_channel: str = Form(default="csv_import"),
    default_stage: str = Form(default="lead"),
    auto_enrich: bool = Form(default=True),
    auto_score: bool = Form(default=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a CSV or Excel (.xlsx/.xls) file and bulk-create Company records."""
    fname = (file.filename or "").lower()
    if not (fname.endswith(".csv") or fname.endswith(".xlsx") or fname.endswith(".xls")):
        raise HTTPException(400, "File must be a .csv, .xlsx, or .xls")

    content = await file.read()
    rows_raw = _parse_file_to_rows(file.filename, content)

    if not rows_raw:
        raise HTTPException(400, "File has no data rows")

    # Normalize headers
    header_map: dict[str, str] = {}
    for h in rows_raw[0].keys():
        canonical = COLUMN_MAP.get(h.strip().lower())
        if canonical:
            header_map[h] = canonical

    if "name" not in header_map.values():
        raise HTTPException(
            400,
            "File must have a 'name' or 'company name' column. "
            "Download the template to see the expected format."
        )

    # Validate stage
    valid_stages = [s.value for s in DealStage]
    if default_stage not in valid_stages:
        default_stage = "lead"

    # Load thesis for auto-scoring
    thesis = None
    if auto_score:
        result = await db.execute(select(ThesisConfig).limit(1))
        thesis = result.scalars().first()

    # Get existing slugs to avoid collisions
    existing_slugs_result = await db.execute(select(Company.slug))
    existing_slugs: set[str] = set(r[0] for r in existing_slugs_result.fetchall())

    # Create import job record
    job = ImportJob(
        filename=file.filename,
        status="processing",
        source_channel=source_channel,
        default_stage=default_stage,
        auto_enrich=auto_enrich,
        auto_score=auto_score,
        imported_by=current_user.username,
    )
    db.add(job)
    await db.flush()

    job.total_rows = len(rows_raw)
    imported_ids: list[int] = []
    errors: list[dict] = []
    skipped = 0

    for i, row in enumerate(rows_raw, start=2):  # row 1 = header
        try:
            # Map columns to canonical names
            mapped: dict[str, str] = {}
            for col, canonical in header_map.items():
                val = str(row.get(col, "") or "").strip()
                if val:
                    mapped[canonical] = val

            name = mapped.get("name", "").strip()
            if not name:
                skipped += 1
                continue

            slug = _make_slug(name, existing_slugs)

            company = Company(
                name=name,
                slug=slug,
                deal_stage=DealStage(default_stage),
                stage_entered_at=datetime.now(timezone.utc),
                source=mapped.get("source") or source_channel,
                is_proprietary=(source_channel == "proprietary"),
            )

            # String fields
            for field in ("website", "industry", "sub_industry", "description",
                          "city", "state", "owner_name", "owner_email",
                          "owner_phone", "linkedin_url"):
                if field in mapped:
                    setattr(company, field, mapped[field])

            # Numeric fields
            for field, parser in [
                ("annual_revenue", _parse_float),
                ("ebitda", _parse_float),
                ("ebitda_margin", _parse_float),
                ("asking_price", _parse_float),
                ("sde_ttm", _parse_float),
                ("employees", _parse_int),
                ("founded_year", _parse_int),
            ]:
                if field in mapped:
                    setattr(company, field, parser(mapped[field]))

            # Tags
            if "tags" in mapped:
                company.tags = [t.strip() for t in mapped["tags"].split(",") if t.strip()]

            db.add(company)
            await db.flush()

            # Auto-score against thesis
            if auto_score and thesis:
                score_result = score_company(company, thesis)
                company.thesis_score = score_result["thesis_score"]
                company.thesis_flags = score_result["flags"]
                company.thesis_scored_at = datetime.now(timezone.utc)
                company.deal_score = score_result["thesis_score"]

            imported_ids.append(company.id)

        except Exception as e:
            errors.append({"row": i, "error": str(e), "data": {k: str(v) for k, v in row.items()}})

    # Finalize job
    job.status = "done"
    job.imported_rows = len(imported_ids)
    job.skipped_rows = skipped
    job.failed_rows = len(errors)
    job.error_log = errors[:50]
    job.company_ids = imported_ids
    job.completed_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "job_id": job.id,
        "status": "done",
        "total_rows": job.total_rows,
        "imported": job.imported_rows,
        "skipped": job.skipped_rows,
        "failed": job.failed_rows,
        "company_ids": imported_ids[:20],
        "errors": errors[:5],
    }


@router.get("/jobs")
async def list_import_jobs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ImportJob).order_by(ImportJob.created_at.desc()).limit(50)
    )
    jobs = result.scalars().all()
    return {
        "total": len(jobs),
        "items": [
            {
                "id": j.id,
                "filename": j.filename,
                "status": j.status,
                "total_rows": j.total_rows,
                "imported_rows": j.imported_rows,
                "skipped_rows": j.skipped_rows,
                "failed_rows": j.failed_rows,
                "source_channel": j.source_channel,
                "auto_score": j.auto_score,
                "imported_by": j.imported_by,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            }
            for j in jobs
        ],
    }


@router.get("/jobs/{job_id}")
async def get_import_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    job = await db.get(ImportJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "id": job.id,
        "filename": job.filename,
        "status": job.status,
        "total_rows": job.total_rows,
        "imported_rows": job.imported_rows,
        "skipped_rows": job.skipped_rows,
        "failed_rows": job.failed_rows,
        "error_log": job.error_log or [],
        "company_ids": job.company_ids or [],
        "source_channel": job.source_channel,
        "auto_enrich": job.auto_enrich,
        "auto_score": job.auto_score,
        "imported_by": job.imported_by,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }
