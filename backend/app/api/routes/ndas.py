"""NDA review, e-signature tracking, and management routes."""
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, Pagination, require_write
from app.models.models import Company, Document, NDA, NDAStatus, User

router = APIRouter()


def _nda_to_dict(n: NDA) -> Dict[str, Any]:
    return {
        "id": n.id,
        "company_id": n.company_id,
        "deal_id": n.deal_id,
        "document_id": n.document_id,
        "status": n.status.value if n.status else "draft",
        "sent_to_email": n.sent_to_email,
        "sent_at": n.sent_at.isoformat() if n.sent_at else None,
        "signed_at": n.signed_at.isoformat() if n.signed_at else None,
        "expires_at": n.expires_at.isoformat() if n.expires_at else None,
        "signatory_name": n.signatory_name,
        "esign_provider": n.esign_provider,
        "esign_envelope_id": n.esign_envelope_id,
        "ai_review_notes": n.ai_review_notes,
        "redlines": n.redlines or [],
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


@router.get("/")
async def list_ndas(
    company_id: Optional[int] = Query(None),
    nda_status: Optional[str] = Query(None, alias="status"),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    q = select(NDA)
    if company_id is not None:
        q = q.where(NDA.company_id == company_id)
    if nda_status:
        try:
            q = q.where(NDA.status == NDAStatus(nda_status))
        except ValueError:
            pass
    q = q.order_by(NDA.created_at.desc())

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset(pagination.skip).limit(pagination.limit))).scalars().all()
    return {"items": [_nda_to_dict(r) for r in rows], "total": total}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_nda(
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
) -> Dict[str, Any]:
    company_id = body.get("company_id")
    if not company_id:
        raise HTTPException(400, "company_id is required")
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    nda = NDA(
        company_id=company_id,
        deal_id=body.get("deal_id"),
        document_id=body.get("document_id"),
        status=NDAStatus(body.get("status", "draft")),
        sent_to_email=body.get("sent_to_email"),
        signatory_name=body.get("signatory_name"),
        esign_provider=body.get("esign_provider"),
    )
    db.add(nda)
    await db.commit()
    await db.refresh(nda)
    return _nda_to_dict(nda)


@router.get("/{nda_id}")
async def get_nda(
    nda_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    nda = await db.get(NDA, nda_id)
    if not nda:
        raise HTTPException(404, "NDA not found")
    return _nda_to_dict(nda)


@router.patch("/{nda_id}")
async def update_nda(
    nda_id: int,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
) -> Dict[str, Any]:
    nda = await db.get(NDA, nda_id)
    if not nda:
        raise HTTPException(404, "NDA not found")

    if "status" in body:
        try:
            nda.status = NDAStatus(body["status"])
        except ValueError:
            raise HTTPException(400, f"Invalid status: {body['status']}")

    for field in ["sent_to_email", "signatory_name", "esign_provider", "esign_envelope_id",
                  "ai_review_notes", "redlines", "document_id", "deal_id"]:
        if field in body:
            setattr(nda, field, body[field])

    if body.get("sent_at"):
        nda.sent_at = datetime.fromisoformat(body["sent_at"])
    if body.get("signed_at"):
        nda.signed_at = datetime.fromisoformat(body["signed_at"])
    if body.get("expires_at"):
        nda.expires_at = datetime.fromisoformat(body["expires_at"])

    await db.commit()
    await db.refresh(nda)
    return _nda_to_dict(nda)


@router.delete("/{nda_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_nda(
    nda_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
):
    nda = await db.get(NDA, nda_id)
    if not nda:
        raise HTTPException(404, "NDA not found")
    await db.delete(nda)
    await db.commit()


@router.post("/{nda_id}/send")
async def send_nda(
    nda_id: int,
    body: Dict[str, Any] = {},
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
) -> Dict[str, Any]:
    """Mark NDA as sent and record timestamp."""
    nda = await db.get(NDA, nda_id)
    if not nda:
        raise HTTPException(404, "NDA not found")
    nda.status = NDAStatus.SENT
    nda.sent_at = datetime.now(timezone.utc)
    if body.get("sent_to_email"):
        nda.sent_to_email = body["sent_to_email"]
    if body.get("signatory_name"):
        nda.signatory_name = body["signatory_name"]
    await db.commit()
    await db.refresh(nda)
    return _nda_to_dict(nda)


@router.post("/{nda_id}/sign")
async def mark_signed(
    nda_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
) -> Dict[str, Any]:
    """Mark NDA as signed."""
    nda = await db.get(NDA, nda_id)
    if not nda:
        raise HTTPException(404, "NDA not found")
    nda.status = NDAStatus.SIGNED
    nda.signed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(nda)
    return _nda_to_dict(nda)


@router.post("/{nda_id}/ai-review")
async def ai_review_nda(
    nda_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
) -> Dict[str, Any]:
    """Use AI to review NDA document for red flags and non-standard terms."""
    nda = await db.get(NDA, nda_id)
    if not nda:
        raise HTTPException(404, "NDA not found")

    # Get the associated document text if available
    doc_text = ""
    if nda.document_id:
        doc = await db.get(Document, nda.document_id)
        if doc and doc.file_path:
            try:
                import os
                if doc.file_path.endswith(".txt"):
                    with open(doc.file_path, "r") as f:
                        doc_text = f.read()[:5000]
                elif doc.file_path.endswith(".pdf"):
                    try:
                        import PyPDF2
                        with open(doc.file_path, "rb") as f:
                            reader = PyPDF2.PdfReader(f)
                            doc_text = " ".join(
                                page.extract_text() or "" for page in reader.pages[:5]
                            )[:5000]
                    except Exception:
                        pass
            except Exception:
                pass

    if not doc_text:
        # Use a generic NDA review prompt
        doc_text = "Standard NDA document - no specific text available for review."

    prompt = f"""You are a legal analyst specializing in M&A transactions and search fund acquisitions.
Review this NDA and identify any red flags, non-standard terms, or areas of concern.

NDA Text:
{doc_text}

Provide a structured review with:
1. Overall assessment (favorable/standard/unfavorable)
2. Key red flags (list up to 5)
3. Non-standard terms (list up to 5)
4. Recommendations (list up to 3)
5. Summary paragraph

Return as JSON with keys: assessment, red_flags, non_standard_terms, recommendations, summary"""

    try:
        from openai import OpenAI
        import os
        client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        )
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1500,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        review = json.loads(raw)
        nda.ai_review_notes = json.dumps(review)
        nda.redlines = review.get("red_flags", [])
    except Exception as e:
        nda.ai_review_notes = json.dumps({
            "assessment": "review_failed",
            "error": str(e),
            "summary": "AI review could not be completed. Please review manually.",
            "red_flags": [],
            "non_standard_terms": [],
            "recommendations": ["Review document manually"],
        })

    await db.commit()
    await db.refresh(nda)
    return _nda_to_dict(nda)


@router.get("/{nda_id}/status")
async def nda_status(
    nda_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    nda = await db.get(NDA, nda_id)
    if not nda:
        raise HTTPException(404, "NDA not found")
    return {
        "nda_id": nda_id,
        "status": nda.status.value if nda.status else "draft",
        "sent_at": nda.sent_at.isoformat() if nda.sent_at else None,
        "signed_at": nda.signed_at.isoformat() if nda.signed_at else None,
        "expires_at": nda.expires_at.isoformat() if nda.expires_at else None,
    }
