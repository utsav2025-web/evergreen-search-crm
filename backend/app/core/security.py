"""Password hashing and session token utilities."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_serializer = URLSafeTimedSerializer(settings.SECRET_KEY)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_session_token(user_id: int) -> str:
    """Create a signed, timed session token."""
    return _serializer.dumps({"uid": user_id}, salt="session")


def decode_session_token(token: str, max_age: int = settings.SESSION_MAX_AGE) -> Optional[int]:
    """Decode and validate a session token. Returns user_id or None."""
    try:
        data = _serializer.loads(token, salt="session", max_age=max_age)
        return data.get("uid")
    except (BadSignature, SignatureExpired):
        return None
