"""
FastAPI router for User Profile Management.
Endpoints: GET /me, PUT /me
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.all_models import User
from app.schemas.user_profile import UserProfileResponse, UserProfileUpdate

router = APIRouter()


# ==========================================
# GET /me - Get Current User Profile
# ==========================================


@router.get("/me", response_model=UserProfileResponse, summary="Get current user profile")
async def get_current_user_profile(
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)]
) -> UserProfileResponse:
    """
    Get the profile of the currently authenticated user.
    
    Returns:
        UserProfileResponse: Complete user profile with role and department info
    """
    # Fetch user with relationships eagerly loaded
    stmt = (
        select(User)
        .where(User.user_id == current_user.user_id)
        .options(
            selectinload(User.role),
            selectinload(User.department)
        )
    )
    
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserProfileResponse.model_validate(user)


# ==========================================
# PUT /me - Update Current User Profile
# ==========================================


@router.put("/me", response_model=UserProfileResponse, summary="Update current user profile")
async def update_current_user_profile(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    profile_update: UserProfileUpdate
) -> UserProfileResponse:
    """
    Update the profile of the currently authenticated user.
    
    Allowed updates:
    - full_name
    - avatar_url (must be valid image URL)
    - phone (must be valid Vietnamese phone number)
    - bio (max 1000 characters)
    
    Args:
        profile_update: Profile data to update
    
    Returns:
        UserProfileResponse: Updated user profile
        
    Raises:
        HTTPException 404: User not found
        HTTPException 422: Validation error (invalid phone/avatar URL)
    """
    # Fetch user with relationships
    stmt = (
        select(User)
        .where(User.user_id == current_user.user_id)
        .options(
            selectinload(User.role),
            selectinload(User.department)
        )
    )
    
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update only provided fields (exclude_unset=True)
    update_data = profile_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    # Commit changes
    await db.commit()
    
    # Re-fetch with relationships loaded using joinedload and populate_existing
    from sqlalchemy.orm import joinedload
    stmt = (
        select(User)
        .where(User.user_id == current_user.user_id)
        .options(
            joinedload(User.role),
            joinedload(User.department)
        )
        .execution_options(populate_existing=True)
    )
    result = await db.execute(stmt)
    user = result.scalar_one()
    
    return UserProfileResponse.model_validate(user)