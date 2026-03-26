"""SBA & conventional lender tracker routes."""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()


@router.get("/")
async def list_lenders(_: User = Depends(get_current_user)):
    return {"items": [], "total": 0}


@router.post("/")
async def create_lender(_: User = Depends(get_current_user)):
    return {"status": "stub"}


@router.get("/{lender_id}")
async def get_lender(lender_id: int, _: User = Depends(get_current_user)):
    return {"id": lender_id, "status": "stub"}
