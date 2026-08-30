"""API endpoints for Milestone management."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models.all_models import (
    AcademicClass,
    Checkpoint,
    Milestone,
    Team,
    User,
)
from app.schemas.milestone import (
    CheckpointCreate,
    CheckpointListResponse,
    CheckpointResponse,
    CheckpointUpdate,
    MilestoneCreate,
    MilestoneListResponse,
    MilestoneResponse,
    MilestoneUpdate,
)

router = APIRouter(prefix="/milestones", tags=["milestones"])


# ==========================================
# MILESTONE ENDPOINTS
# ==========================================

@router.post(
    "",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new milestone"
)
async def create_milestone(
    milestone_data: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new milestone for a class.
    
    **Required permissions:** Lecturer of the class
    
    **Validation:**
    - Class must exist
    - User must be the lecturer of the class
    - Due date must be in the future
    """
    # Verify class exists and user is the lecturer
    query = select(AcademicClass).where(AcademicClass.class_id == milestone_data.class_id)
    result = await db.execute(query)
    academic_class = result.scalar_one_or_none()
    
    if not academic_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    if academic_class.lecturer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the class lecturer can create milestones"
        )
    
    # Validate due date is in the future
    if milestone_data.due_date <= datetime.now(milestone_data.due_date.tzinfo):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date must be in the future"
        )
    
    # Create milestone
    new_milestone = Milestone(
        class_id=milestone_data.class_id,
        title=milestone_data.title,
        description=milestone_data.description,
        due_date=milestone_data.due_date,
        created_by=current_user.user_id
    )
    
    db.add(new_milestone)
    await db.commit()
    await db.refresh(new_milestone)
    
    return new_milestone


@router.get(
    "",
    response_model=List[MilestoneListResponse],
    summary="List milestones"
)
async def list_milestones(
    class_id: Optional[int] = Query(None, description="Filter by class ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List milestones with optional filtering.
    
    **Filters:**
    - class_id: Filter by specific class
    
    **Pagination:** Use skip and limit parameters
    """
    query = select(Milestone)
    
    if class_id:
        query = query.where(Milestone.class_id == class_id)
    
    query = query.order_by(Milestone.due_date).offset(skip).limit(limit)
    
    result = await db.execute(query)
    milestones = result.scalars().all()
    
    # Get checkpoint counts for each milestone
    milestone_list = []
    for milestone in milestones:
        checkpoint_query = select(func.count(Checkpoint.checkpoint_id)).where(
            Checkpoint.milestone_id == milestone.milestone_id
        )
        checkpoint_result = await db.execute(checkpoint_query)
        checkpoint_count = checkpoint_result.scalar()
        
        milestone_list.append(
            MilestoneListResponse(
                milestone_id=milestone.milestone_id,
                class_id=milestone.class_id,
                title=milestone.title,
                due_date=milestone.due_date,
                created_by=milestone.created_by,
                checkpoint_count=checkpoint_count
            )
        )
    
    return milestone_list


@router.get(
    "/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Get milestone details"
)
async def get_milestone(
    milestone_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information about a specific milestone.
    
    **Includes:**
    - All checkpoints associated with the milestone
    """
    query = (
        select(Milestone)
        .options(selectinload(Milestone.checkpoints))
        .where(Milestone.milestone_id == milestone_id)
    )
    
    result = await db.execute(query)
    milestone = result.scalar_one_or_none()
    
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    
    return milestone


@router.put(
    "/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Update milestone"
)
async def update_milestone(
    milestone_id: int,
    milestone_update: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a milestone.
    
    **Required permissions:** Lecturer who created the milestone
    
    **Validation:**
    - Only the creating lecturer can update
    - Due date (if updated) must be in the future
    """
    query = select(Milestone).where(Milestone.milestone_id == milestone_id)
    result = await db.execute(query)
    milestone = result.scalar_one_or_none()
    
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    
    if milestone.created_by != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creating lecturer can update this milestone"
        )
    
    # Update fields
    update_data = milestone_update.model_dump(exclude_unset=True)
    
    if "due_date" in update_data:
        if update_data["due_date"] <= datetime.now(update_data["due_date"].tzinfo):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Due date must be in the future"
            )
    
    for field, value in update_data.items():
        setattr(milestone, field, value)
    
    await db.commit()
    await db.refresh(milestone, ["checkpoints"])
    
    return milestone


@router.delete(
    "/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete milestone"
)
async def delete_milestone(
    milestone_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a milestone and all associated checkpoints.
    
    **Required permissions:** Lecturer who created the milestone
    
    **Warning:** This will cascade delete all checkpoints and submissions!
    """
    query = select(Milestone).where(Milestone.milestone_id == milestone_id)
    result = await db.execute(query)
    milestone = result.scalar_one_or_none()
    
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    
    if milestone.created_by != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creating lecturer can delete this milestone"
        )
    
    await db.delete(milestone)
    await db.commit()
    
    return None


# ==========================================
# CHECKPOINT ENDPOINTS
# ==========================================

@router.post(
    "/{milestone_id}/checkpoints",
    response_model=CheckpointResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add checkpoint to milestone"
)
async def create_checkpoint(
    milestone_id: int,
    checkpoint_data: CheckpointCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new checkpoint to a milestone for a specific team.
    
    **Required permissions:** Lecturer of the class
    
    **Validation:**
    - Milestone must exist
    - Team must exist and belong to the same class
    - User must be the class lecturer
    """
    # Verify milestone_id matches
    if checkpoint_data.milestone_id != milestone_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Milestone ID mismatch"
        )
    
    # Verify milestone exists and get class info
    milestone_query = (
        select(Milestone)
        .options(selectinload(Milestone.academic_class))
        .where(Milestone.milestone_id == milestone_id)
    )
    milestone_result = await db.execute(milestone_query)
    milestone = milestone_result.scalar_one_or_none()
    
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    
    # Verify user is the lecturer
    if milestone.academic_class.lecturer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the class lecturer can create checkpoints"
        )
    
    # Verify team exists and belongs to the same class
    team_query = select(Team).where(Team.team_id == checkpoint_data.team_id)
    team_result = await db.execute(team_query)
    team = team_result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    if team.class_id != milestone.class_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team does not belong to this class"
        )
    
    # Create checkpoint
    new_checkpoint = Checkpoint(
        milestone_id=milestone_id,
        team_id=checkpoint_data.team_id,
        title=checkpoint_data.title,
        status=checkpoint_data.status or "pending"
    )
    
    db.add(new_checkpoint)
    await db.commit()
    await db.refresh(new_checkpoint)
    
    return new_checkpoint


@router.get(
    "/{milestone_id}/checkpoints",
    response_model=List[CheckpointListResponse],
    summary="List checkpoints for milestone"
)
async def list_checkpoints(
    milestone_id: int,
    team_id: Optional[int] = Query(None, description="Filter by team ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all checkpoints for a specific milestone.
    
    **Filters:**
    - team_id: Filter by specific team
    """
    # Verify milestone exists
    milestone_query = select(Milestone).where(Milestone.milestone_id == milestone_id)
    milestone_result = await db.execute(milestone_query)
    milestone = milestone_result.scalar_one_or_none()
    
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    
    # Get checkpoints
    query = select(Checkpoint).where(Checkpoint.milestone_id == milestone_id)
    
    if team_id:
        query = query.where(Checkpoint.team_id == team_id)
    
    query = query.order_by(Checkpoint.checkpoint_id)
    
    result = await db.execute(query)
    checkpoints = result.scalars().all()
    
    return checkpoints


@router.put(
    "/{milestone_id}/checkpoints/{checkpoint_id}",
    response_model=CheckpointResponse,
    summary="Update checkpoint"
)
async def update_checkpoint(
    milestone_id: int,
    checkpoint_id: int,
    checkpoint_update: CheckpointUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a checkpoint.
    
    **Required permissions:** Lecturer of the class
    """
    query = (
        select(Checkpoint)
        .options(selectinload(Checkpoint.milestone).selectinload(Milestone.academic_class))
        .where(Checkpoint.checkpoint_id == checkpoint_id, Checkpoint.milestone_id == milestone_id)
    )
    result = await db.execute(query)
    checkpoint = result.scalar_one_or_none()
    
    if not checkpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkpoint not found"
        )
    
    if checkpoint.milestone.academic_class.lecturer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the class lecturer can update checkpoints"
        )
    
    # Update fields
    update_data = checkpoint_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(checkpoint, field, value)
    
    await db.commit()
    await db.refresh(checkpoint)
    
    return checkpoint


@router.delete(
    "/{milestone_id}/checkpoints/{checkpoint_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete checkpoint"
)
async def delete_checkpoint(
    milestone_id: int,
    checkpoint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a checkpoint.
    
    **Required permissions:** Lecturer of the class
    
    **Warning:** This will cascade delete all submissions for this checkpoint!
    """
    query = (
        select(Checkpoint)
        .options(selectinload(Checkpoint.milestone).selectinload(Milestone.academic_class))
        .where(Checkpoint.checkpoint_id == checkpoint_id, Checkpoint.milestone_id == milestone_id)
    )
    result = await db.execute(query)
    checkpoint = result.scalar_one_or_none()
    
    if not checkpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkpoint not found"
        )
    
    if checkpoint.milestone.academic_class.lecturer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the class lecturer can delete checkpoints"
        )
    
    await db.delete(checkpoint)
    await db.commit()
    
    return None