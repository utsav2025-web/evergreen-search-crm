"""
Auth routes — Soft Login (profile selector, no password required).

Endpoints:
  GET  /api/auth/profiles  → list available profiles (Matt, Utsav)
  POST /api/auth/login     → select a profile by username → set 30-day session cookie
  POST /api/auth/logout    → clear session cookie
  GET  /api/auth/me        → current user info
  GET  /api/auth/partners  → partner list for @mention picker
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, COOKIE_NAME
from app.db.base import get_db
from app.models.models import User

router = APIRouter()

SESSION_DAYS = 30

# ─── Profile definitions ──────────────────────────────────────────────────────

PROFILES = [
    {"username": "matt",  "display_name": "Matt",  "initials": "MW", "avatar_color": "bg-blue-600"},
    {"username": "utsav", "display_name": "Utsav", "initials": "UP", "avatar_color": "bg-emerald-600"},
]
PROFILE_MAP = {p["username"]: p for p in PROFILES}

# ─── Pydantic models ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str  # "matt" or "utsav"

# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/profiles")
async def list_profiles():
    """Return the two partner profiles for the profile selector UI."""
    return PROFILES


@router.post("/login")
async def soft_login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Soft login — select a profile by username, no password required.
    Sets a 30-day session cookie.
    """
    username = body.username.lower().strip()
    if username not in PROFILE_MAP:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown profile")

    profile = PROFILE_MAP[username]

    # Upsert user in DB
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            username=username,
            display_name=profile["display_name"],
            email=None,
            role="partner",
            is_active=True,
            password_hash="",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Create a session token and store it
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)

    user.session_token = token
    user.session_expires_at = expires
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    # Set cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=SESSION_DAYS * 86400,
        path="/",
    )

    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "email": user.email,
        "role": user.role,
        "initials": profile["initials"],
        "avatar_color": profile["avatar_color"],
    }


@router.post("/logout")
async def logout(response: Response):
    """Clear session cookie."""
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return current user info."""
    profile = PROFILE_MAP.get(current_user.username, {})
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "initials": profile.get("initials", current_user.display_name[:2].upper()),
        "avatar_color": profile.get("avatar_color", "bg-gray-500"),
        "avatar_url": getattr(current_user, "avatar_url", None),
        "permissions": {
            "can_write": True,
            "can_settings": True,
            "can_export": True,
            "is_guest": False,
        },
    }


@router.get("/partners")
async def get_partners(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return partner list for @mention picker."""
    result = await db.execute(
        select(User).where(User.is_active == True, User.role == "partner")
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "initials": PROFILE_MAP.get(u.username, {}).get("initials", u.display_name[:2].upper()),
            "avatar_color": PROFILE_MAP.get(u.username, {}).get("avatar_color", "bg-gray-500"),
        }
        for u in users
    ]
