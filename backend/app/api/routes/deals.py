"""Deals routes — CRUD + stage transitions."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import Deal, DealStage, User

router = APIRouter()


class DealStageUpdate(BaseModel):
    stage: DealStage


@router.get("/")
async def list_deals(
    stage: Optional[str] = None,
    company_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Deal)
    if stage:
        query = query.where(Deal.stage == stage)
    if company_id:
        query = query.where(Deal.company_id == company_id)
    result = await db.execute(query)
    return {"items": result.scalars().all(), "total": 0}


@router.post("/")
async def create_deal(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return {"status": "stub"}


@router.get("/{deal_id}")
async def get_deal(deal_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.patch("/{deal_id}/stage")
async def update_deal_stage(
    deal_id: int,
    body: DealStageUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal.stage = body.stage
    await db.commit()
    return {"id": deal_id, "stage": body.stage}


@router.patch("/{deal_id}")
async def update_deal(deal_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return {"id": deal_id, "status": "stub"}


@router.delete("/{deal_id}")
async def delete_deal(deal_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return {"status": "deleted"}
