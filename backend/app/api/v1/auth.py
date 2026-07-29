from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.all_models import Role, User
from app.schemas import token as token_schema
from app.schemas import user as user_schema

router = APIRouter()

@router.post("/login", response_model=token_schema.Token)
async def login_access_token(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    # 1. Tìm user theo email
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()

    # 2. Kiểm tra mật khẩu
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # 3. Tạo Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            subject=user.user_id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/register", response_model=user_schema.UserResponse)
async def register_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: user_schema.UserCreate,
) -> Any:
    """
    Create new user.
    """
    # 1. Check email trùng
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )

    # 2. Hash password và tạo User
    try:
        hashed_password = security.get_password_hash(user_in.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    role_result = await db.execute(select(Role).where(Role.role_id == user_in.role_id))
    role = role_result.scalars().first()
    if not role:
        raise HTTPException(
            status_code=400,
            detail="Invalid role_id. Use one of: 1=Admin, 2=Staff, 3=Head_Dept, 4=Lecturer, 5=Student.",
        )

    user = User(
        email=user_in.email,
        password_hash=hashed_password,
        full_name=user_in.full_name,
        role_id=user_in.role_id,
        dept_id=user_in.dept_id,
        is_active=True,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user