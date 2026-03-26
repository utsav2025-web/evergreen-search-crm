"""Comparable transactions (comps) routes."""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()


@router.get("/")
async def list_comps(industry: str = None, _: User = Depends(get_current_user)):
    return {"items": [], "total": 0}


@router.post("/")
async def create_comp(_: User = Depends(get_current_user)):
    return {"status": "stub"}


@router.get("/multiples")
async def get_industry_multiples(industry: str, _: User = Depends(get_current_user)):
    """Return EV/Revenue and EV/EBITDA median multiples for an industry."""
    return {"industry": industry, "ev_revenue": None, "ev_ebitda": None, "status": "stub"}
