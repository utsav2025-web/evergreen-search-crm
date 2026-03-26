"""Contacts routes — stub."""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()


@router.get("/")
async def list_contacts(_: User = Depends(get_current_user)):
    return {"items": [], "total": 0}


@router.post("/")
async def create_contact(_: User = Depends(get_current_user)):
    return {"status": "stub"}


@router.get("/{contact_id}")
async def get_contact(contact_id: int, _: User = Depends(get_current_user)):
    return {"id": contact_id, "status": "stub"}


@router.patch("/{contact_id}")
async def update_contact(contact_id: int, _: User = Depends(get_current_user)):
    return {"id": contact_id, "status": "stub"}


@router.delete("/{contact_id}")
async def delete_contact(contact_id: int, _: User = Depends(get_current_user)):
    return {"status": "deleted"}
