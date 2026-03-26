"""
Notes CRUD routes.

Endpoints
---------
GET    /notes/                  List + filter notes
POST   /notes/                  Create note
GET    /notes/{id}              Get note
PATCH  /notes/{id}              Update note
DELETE /notes/{id}              Delete note
POST   /notes/{id}/pin          Toggle pin status
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, Pagination
from app.models.models import Company, DealStage, Note, User
from app.schemas.note import NoteCreate, NoteUpdate, NoteOut, NoteListOut

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=NoteListOut)
async def list_notes(
    company_id: Optional[int] = Query(None),
    deal_id: Optional[int] = Query(None),
    tagged_stage: Optional[DealStage] = Query(None),
    note_type: Optional[str] = Query(None),
    is_pinned: Optional[bool] = Query(None),
    author_id: Optional[int] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a paginated, filterable list of notes."""
    q = select(Note)

    if company_id is not None:
        q = q.where(Note.company_id == company_id)
    if deal_id is not None:
        q = q.where(Note.deal_id == deal_id)
    if tagged_stage:
        q = q.where(Note.tagged_stage == tagged_stage)
    if note_type:
        q = q.where(Note.note_type == note_type)
    if is_pinned is not None:
        q = q.where(Note.is_pinned == is_pinned)
    if author_id is not None:
        q = q.where(Note.author_id == author_id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    # Pinned notes first, then newest
    q = (q.order_by(Note.is_pinned.desc(), Note.created_at.desc())
          .offset(pagination.skip)
          .limit(pagination.limit))
    notes = (await db.execute(q)).scalars().all()

    return NoteListOut(
        total=total,
        items=[NoteOut.model_validate(n) for n in notes],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(
    body: NoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new note."""
    # Validate company if provided
    if body.company_id:
        company_q = await db.execute(
            select(Company).where(Company.id == body.company_id, Company.is_active == True)
        )
        if not company_q.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Company not found")

    data = body.model_dump()
    if data.get("author_id") is None:
        data["author_id"] = current_user.id

    note = Note(**data)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note)


# ─────────────────────────────────────────────────────────────────────────────
# Get one
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{note_id}", response_model=NoteOut)
async def get_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteOut.model_validate(note)


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: int,
    body: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    # Only the author can edit
    if note.author_id and note.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can edit this note")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note)


# ─────────────────────────────────────────────────────────────────────────────
# Delete
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.author_id and note.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can delete this note")
    await db.delete(note)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Toggle pin
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{note_id}/pin", response_model=NoteOut)
async def toggle_pin(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Toggle the pinned status of a note."""
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note.is_pinned = not note.is_pinned
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note)
