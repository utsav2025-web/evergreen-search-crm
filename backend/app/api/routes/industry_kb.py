"""Industry Knowledge Base routes with full CRUD."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, Pagination, require_write
from app.models.models import CompTransaction, IndustryKB, User

router = APIRouter()


def _kb_to_dict(k: IndustryKB) -> Dict[str, Any]:
    return {
        "id": k.id,
        "industry": k.industry,
        "sub_industry": k.sub_industry,
        "title": k.title,
        "content": k.content,
        "source_url": k.source_url,
        "tags": k.tags or [],
        "added_by": k.added_by,
        "is_public": k.is_public,
        "created_at": k.created_at.isoformat() if k.created_at else None,
        "updated_at": k.updated_at.isoformat() if k.updated_at else None,
    }


def _comp_to_dict(c: CompTransaction) -> Dict[str, Any]:
    return {
        "id": c.id,
        "target_name": c.target_name,
        "industry": c.industry,
        "sub_industry": c.sub_industry,
        "transaction_date": c.transaction_date.isoformat() if c.transaction_date else None,
        "enterprise_value": c.enterprise_value,
        "revenue_ttm": c.revenue_ttm,
        "ebitda_ttm": c.ebitda_ttm,
        "ev_revenue_multiple": c.ev_revenue_multiple,
        "ev_ebitda_multiple": c.ev_ebitda_multiple,
        "buyer_type": c.buyer_type,
        "source": c.source,
        "notes_text": c.notes_text,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Industry KB
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_kb_entries(
    industry: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    q = select(IndustryKB)
    if industry:
        q = q.where(IndustryKB.industry.ilike(f"%{industry}%"))
    if search:
        q = q.where(or_(
            IndustryKB.title.ilike(f"%{search}%"),
            IndustryKB.content.ilike(f"%{search}%"),
        ))
    q = q.order_by(IndustryKB.created_at.desc())

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset(pagination.skip).limit(pagination.limit))).scalars().all()

    # Filter by tag in Python (JSON array)
    if tag:
        rows = [r for r in rows if tag in (r.tags or [])]

    return {"items": [_kb_to_dict(r) for r in rows], "total": total}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_kb_entry(
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_write),
) -> Dict[str, Any]:
    if not body.get("title") or not body.get("content"):
        raise HTTPException(400, "title and content are required")
    entry = IndustryKB(
        industry=body.get("industry", "General"),
        sub_industry=body.get("sub_industry"),
        title=body["title"],
        content=body["content"],
        source_url=body.get("source_url"),
        tags=body.get("tags", []),
        added_by=user.id,
        is_public=body.get("is_public", True),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _kb_to_dict(entry)


@router.get("/industries")
async def list_industries(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[str]:
    """Return distinct industries in the KB."""
    result = await db.execute(
        select(IndustryKB.industry).distinct().order_by(IndustryKB.industry)
    )
    return [r[0] for r in result.fetchall() if r[0]]


@router.get("/{entry_id}")
async def get_kb_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    entry = await db.get(IndustryKB, entry_id)
    if not entry:
        raise HTTPException(404, "KB entry not found")
    return _kb_to_dict(entry)


@router.patch("/{entry_id}")
async def update_kb_entry(
    entry_id: int,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
) -> Dict[str, Any]:
    entry = await db.get(IndustryKB, entry_id)
    if not entry:
        raise HTTPException(404, "KB entry not found")
    for field in ["industry", "sub_industry", "title", "content", "source_url", "tags", "is_public"]:
        if field in body:
            setattr(entry, field, body[field])
    await db.commit()
    await db.refresh(entry)
    return _kb_to_dict(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
):
    entry = await db.get(IndustryKB, entry_id)
    if not entry:
        raise HTTPException(404, "KB entry not found")
    await db.delete(entry)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Comparable Transactions
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/comps/")
async def list_comp_transactions(
    industry: Optional[str] = Query(None),
    buyer_type: Optional[str] = Query(None),
    min_ev: Optional[float] = Query(None),
    max_ev: Optional[float] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    q = select(CompTransaction)
    if industry:
        q = q.where(CompTransaction.industry.ilike(f"%{industry}%"))
    if buyer_type:
        q = q.where(CompTransaction.buyer_type == buyer_type)
    if min_ev is not None:
        q = q.where(CompTransaction.enterprise_value >= min_ev)
    if max_ev is not None:
        q = q.where(CompTransaction.enterprise_value <= max_ev)
    q = q.order_by(CompTransaction.transaction_date.desc().nullslast())

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset(pagination.skip).limit(pagination.limit))).scalars().all()
    return {"items": [_comp_to_dict(r) for r in rows], "total": total}


@router.post("/comps/", status_code=status.HTTP_201_CREATED)
async def create_comp_transaction(
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
) -> Dict[str, Any]:
    from datetime import datetime
    tx_date = None
    if body.get("transaction_date"):
        try:
            tx_date = datetime.fromisoformat(body["transaction_date"])
        except Exception:
            pass

    comp = CompTransaction(
        target_name=body.get("target_name"),
        industry=body.get("industry"),
        sub_industry=body.get("sub_industry"),
        transaction_date=tx_date,
        enterprise_value=body.get("enterprise_value"),
        revenue_ttm=body.get("revenue_ttm"),
        ebitda_ttm=body.get("ebitda_ttm"),
        ev_revenue_multiple=body.get("ev_revenue_multiple"),
        ev_ebitda_multiple=body.get("ev_ebitda_multiple"),
        buyer_type=body.get("buyer_type"),
        source=body.get("source"),
        notes_text=body.get("notes_text"),
        raw_data=body.get("raw_data", {}),
    )
    # Auto-calculate multiples if not provided
    if comp.ev_ebitda_multiple is None and comp.enterprise_value and comp.ebitda_ttm and comp.ebitda_ttm > 0:
        comp.ev_ebitda_multiple = round(comp.enterprise_value / comp.ebitda_ttm, 2)
    if comp.ev_revenue_multiple is None and comp.enterprise_value and comp.revenue_ttm and comp.revenue_ttm > 0:
        comp.ev_revenue_multiple = round(comp.enterprise_value / comp.revenue_ttm, 2)

    db.add(comp)
    await db.commit()
    await db.refresh(comp)
    return _comp_to_dict(comp)


@router.get("/comps/stats")
async def comp_stats(
    industry: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return median multiples for comps."""
    q = select(CompTransaction)
    if industry:
        q = q.where(CompTransaction.industry.ilike(f"%{industry}%"))
    rows = (await db.execute(q)).scalars().all()

    ev_ebitda = sorted([r.ev_ebitda_multiple for r in rows if r.ev_ebitda_multiple])
    ev_rev = sorted([r.ev_revenue_multiple for r in rows if r.ev_revenue_multiple])

    def median(lst):
        if not lst:
            return None
        n = len(lst)
        return lst[n // 2] if n % 2 else (lst[n // 2 - 1] + lst[n // 2]) / 2

    return {
        "total": len(rows),
        "median_ev_ebitda": median(ev_ebitda),
        "median_ev_revenue": median(ev_rev),
        "min_ev_ebitda": min(ev_ebitda) if ev_ebitda else None,
        "max_ev_ebitda": max(ev_ebitda) if ev_ebitda else None,
    }


@router.delete("/comps/{comp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comp(
    comp_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_write),
):
    comp = await db.get(CompTransaction, comp_id)
    if not comp:
        raise HTTPException(404, "Comparable transaction not found")
    await db.delete(comp)
    await db.commit()
