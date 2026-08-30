"""Security utilities for password hashing and JWT tokens."""
from datetime import datetime, timedelta, timezone
from typing import Any, Union

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Maximum password length for bcrypt compatibility (72 bytes)
MAX_BCRYPT_BYTES = 72

try:  # pragma: no cover - defensive patch for bcrypt>=4.1
    import bcrypt  # type: ignore
    from types import SimpleNamespace

    if not hasattr(bcrypt, "__about__") and hasattr(bcrypt, "__version__"):
        bcrypt.__about__ = SimpleNamespace(__version__=bcrypt.__version__)
except Exception:  # noqa: BLE001 - failing silently keeps startup resilient
    pass
# Setup password hashing (PBKDF2 to avoid bcrypt wheel issues on some platforms)
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if plain password matches hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password for storing in database."""
    if len(password.encode("utf-8")) > MAX_BCRYPT_BYTES:
        raise ValueError("Password must be at most 72 bytes when encoded in UTF-8")
    return pwd_context.hash(password)


def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """Generate JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict | None:
    """
    Verify JWT token and return payload.
    Used by Socket.IO for authentication.
    
    Args:
        token: JWT token string
    
    Returns:
        Token payload dict or None if invalid
    """
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None