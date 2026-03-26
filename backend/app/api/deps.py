"""FastAPI dependency functions — auth, DB session, pagination, role guards."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.models.models import User

# Cookie name — must match what auth.py sets
COOKIE_NAME = "sf_session"


async def get_current_user(
    sf_session: Optional[str] = Cookie(default=None, alias="sf_session"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate session cookie (raw token stored in User.session_token).
    Returns the authenticated User or raises 401.
    """
    if not sf_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    result = await db.execute(
        select(User).where(User.session_token == sf_session, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid")

    if user.session_expires_at:
        # Ensure both datetimes are timezone-aware for comparison
        exp = user.session_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired — please sign in again")

    return user


async def get_optional_user(
    sf_session: Optional[str] = Cookie(default=None, alias="sf_session"),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising 401."""
    if not sf_session:
        return None
    result = await db.execute(
        select(User).where(User.session_token == sf_session, User.is_active == True)
    )
    return result.scalar_one_or_none()


async def require_partner(current_user: User = Depends(get_current_user)) -> User:
    """Block non-partner users from write operations."""
    if current_user.role != "partner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only partners can make changes.")
    return current_user


# Alias
require_write = require_partner


class Pagination:
    def __init__(self, skip: int = 0, limit: int = 50):
        self.skip = max(0, skip)
        self.limit = min(200, max(1, limit))
