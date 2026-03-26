"""Call scheduling, prep, and logging routes."""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()


@router.get("/")
async def list_calls(_: User = Depends(get_current_user)):
    return {"items": [], "total": 0}


@router.post("/")
async def schedule_call(_: User = Depends(get_current_user)):
    return {"status": "stub"}


@router.get("/{call_id}")
async def get_call(call_id: int, _: User = Depends(get_current_user)):
    return {"id": call_id, "status": "stub"}


@router.patch("/{call_id}")
async def update_call(call_id: int, _: User = Depends(get_current_user)):
    return {"id": call_id, "status": "stub"}


@router.post("/{call_id}/prep")
async def generate_call_prep(call_id: int, _: User = Depends(get_current_user)):
    """Trigger AI call prep generation."""
    return {"status": "queued", "call_id": call_id}


@router.post("/{call_id}/complete")
async def complete_call(call_id: int, _: User = Depends(get_current_user)):
    return {"status": "stub", "call_id": call_id}
