"""Security utilities for password hashing and JWT tokens."""
from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
from app.core.config import settings
import bcrypt

# Maximum password length for bcrypt compatibility (72 bytes)
MAX_BCRYPT_BYTES = 72


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if plain password matches hashed password using pure bcrypt."""
    try:
        password_byte_enc = plain_password.encode('utf-8')
        hashed_password_byte_enc = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password for storing in database using pure bcrypt."""
    if len(password.encode("utf-8")) > MAX_BCRYPT_BYTES:
        raise ValueError("Password must be at most 72 bytes when encoded in UTF-8")
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')


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