"""Pipeline Kanban view routes."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import Deal, DealStage, User

router = APIRouter()

STAGE_ORDER = [s.value for s in DealStage]


@router.get("/board")
async def get_kanban_board(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all deals grouped by pipeline stage for Kanban view."""
    result = await db.execute(select(Deal))
    deals = result.scalars().all()
    board = {stage: [] for stage in STAGE_ORDER}
    for deal in deals:
        board[deal.stage.value].append(deal)
    return {"stages": STAGE_ORDER, "board": board}


@router.get("/stats")
async def pipeline_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return summary counts and values by stage."""
    return {"status": "stub"}
