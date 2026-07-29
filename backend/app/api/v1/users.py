from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.api import deps
from app.db.session import get_db
from app.models.all_models import User, Role
from app.schemas import user as user_schema

router = APIRouter()


@router.get("/me", response_model=user_schema.UserResponse, tags=["users"])
async def read_current_user(current_user: User = Depends(deps.get_current_user)) -> user_schema.UserResponse:
    """Return the currently authenticated user's profile."""
    return current_user


def _require_admin(current_user: User):
    if current_user.role_id not in [1, 2, 3]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )


@router.get("", response_model=List[user_schema.UserAdminResponse], tags=["users"])
async def list_users(
    role_id: Optional[int] = Query(None),
    role_name: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    response: Response = None,
):
    _require_admin(current_user)

    filters = []
    if role_id is not None:
        filters.append(User.role_id == role_id)
    if role_name:
        filters.append(Role.role_name.ilike(role_name))
    if search:
        pattern = f"%{search}%"
        filters.append(or_(User.email.ilike(pattern), User.full_name.ilike(pattern)))

    count_query = select(func.count(User.user_id)).select_from(User).join(Role, User.role_id == Role.role_id)
    if filters:
        count_query = count_query.where(*filters)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    query = select(User, Role).join(Role, User.role_id == Role.role_id)
    if filters:
        query = query.where(*filters)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)

    if response is not None:
        response.headers["X-Total-Count"] = str(total)

    users = []
    for user, role in result.all():
        users.append(user_schema.UserAdminResponse(
            user_id=user.user_id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            role_id=user.role_id,
            role_name=role.role_name if role else None,
            avatar_url=user.avatar_url,
            can_create_topics=user.can_create_topics,
        ))

    return users


@router.patch("/{user_id}/topic-permission", response_model=user_schema.UserAdminResponse, tags=["users"])
async def update_topic_permission(
    user_id: UUID,
    payload: user_schema.UserTopicPermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _require_admin(current_user)

    result = await db.execute(
        select(User, Role)
        .join(Role, User.role_id == Role.role_id)
        .where(User.user_id == user_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    user, role = row
    user.can_create_topics = payload.can_create_topics
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user_schema.UserAdminResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        role_id=user.role_id,
        role_name=role.role_name if role else None,
        avatar_url=user.avatar_url,
        can_create_topics=user.can_create_topics,
    )


@router.patch("/{user_id}/toggle-active", response_model=user_schema.UserAdminResponse, tags=["users"])
async def toggle_user_active(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Toggle user active status (activate/deactivate). Admin only."""
    _require_admin(current_user)

    result = await db.execute(
        select(User, Role)
        .join(Role, User.role_id == Role.role_id)
        .where(User.user_id == user_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    user, role = row
    user.is_active = not user.is_active
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user_schema.UserAdminResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        role_id=user.role_id,
        role_name=role.role_name if role else None,
        avatar_url=user.avatar_url,
        can_create_topics=user.can_create_topics,
    )