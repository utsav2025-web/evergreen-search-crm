"""Broker CRM routes."""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()


@router.get("/")
async def list_brokers(_: User = Depends(get_current_user)):
    return {"items": [], "total": 0}


@router.post("/")
async def create_broker(_: User = Depends(get_current_user)):
    return {"status": "stub"}


@router.get("/{broker_id}")
async def get_broker(broker_id: int, _: User = Depends(get_current_user)):
    return {"id": broker_id, "status": "stub"}


@router.patch("/{broker_id}")
async def update_broker(broker_id: int, _: User = Depends(get_current_user)):
    return {"id": broker_id, "status": "stub"}
