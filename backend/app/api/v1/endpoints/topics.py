"""API endpoints for Topic (Project Proposal) CRUD - BE-PROJ-01."""
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.all_models import Department, Topic, User
from app.schemas.project import (
    TopicCreate,
    TopicResponse,
    TopicStatus,
    TopicStatusUpdate,
    TopicUpdate,
)

router = APIRouter()


async def validate_department_exists(db: AsyncSession, dept_id: int) -> Department:
    """FIX BUG-04: Validate department exists."""
    result = await db.execute(select(Department).where(Department.dept_id == dept_id))
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with id {dept_id} not found"
        )
    return dept


@router.post("/", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    *,
    db: AsyncSession = Depends(deps.get_db),
    topic_in: TopicCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new topic (project proposal).
    Only Lecturers can create topics. Initial status is DRAFT.
    """
    # Check if user is a Lecturer (role_id = 4)
    if current_user.role_id not in [1, 4]:  # Admin or Lecturer
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can create topics",
        )
    
    # FIX BUG-04: Validate department exists
    await validate_department_exists(db, topic_in.dept_id)

    topic = Topic(
        title=topic_in.title,
        description=topic_in.description,
        objectives=topic_in.objectives,
        tech_stack=topic_in.tech_stack,
        creator_id=current_user.user_id,
        dept_id=topic_in.dept_id,
        status=TopicStatus.DRAFT.value,
    )

    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.get("/", response_model=List[TopicResponse])
async def list_topics(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
    dept_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    List all topics with optional filters.
    Students can only see APPROVED topics.
    """
    query = select(Topic)

    # Students can only see approved topics
    if current_user.role_id == 5:  # Student
        query = query.where(Topic.status == TopicStatus.APPROVED.value)
    elif status_filter:
        # FIX: Case-insensitive status filter
        query = query.where(Topic.status == status_filter.upper())

    if dept_id:
        query = query.where(Topic.dept_id == dept_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{topic_id}", response_model=TopicResponse)
async def get_topic(
    topic_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get topic by ID."""
    result = await db.execute(select(Topic).where(Topic.topic_id == topic_id))
    topic = result.scalars().first()

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Students can only see approved topics
    if current_user.role_id == 5 and topic.status != TopicStatus.APPROVED.value:
        raise HTTPException(status_code=403, detail="Topic not available")

    return topic


@router.put("/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: int,
    topic_in: TopicUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update topic. Only owner (creator) can update.
    """
    result = await db.execute(select(Topic).where(Topic.topic_id == topic_id))
    topic = result.scalars().first()

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if topic.creator_id != current_user.user_id and current_user.role_id != 1:
        raise HTTPException(status_code=403, detail="Not authorized to update this topic")

    # Update fields
    update_data = topic_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(topic, field, value)

    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    topic_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """
    Delete topic. Only owner (creator) or Admin can delete.
    """
    result = await db.execute(select(Topic).where(Topic.topic_id == topic_id))
    topic = result.scalars().first()

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if topic.creator_id != current_user.user_id and current_user.role_id != 1:
        raise HTTPException(status_code=403, detail="Not authorized to delete this topic")

    await db.delete(topic)
    await db.commit()


@router.patch("/{topic_id}/status", response_model=TopicResponse)
async def update_topic_status(
    topic_id: int,
    status_in: TopicStatusUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update topic status.
    Flow: DRAFT -> PENDING -> APPROVED
    - Lecturer can change DRAFT -> PENDING
    - Head of Dept (role_id=3) or Admin can change PENDING -> APPROVED
    """
    result = await db.execute(select(Topic).where(Topic.topic_id == topic_id))
    topic = result.scalars().first()

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    current_status = topic.status
    new_status = status_in.status.value

    # Validate status transition
    valid_transitions = {
        TopicStatus.DRAFT.value: [TopicStatus.PENDING.value],
        TopicStatus.PENDING.value: [TopicStatus.APPROVED.value, TopicStatus.DRAFT.value],
        TopicStatus.APPROVED.value: [],
    }

    if new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {current_status} to {new_status}",
        )

    # Check permissions
    if new_status == TopicStatus.PENDING.value:
        # Lecturer can submit for review
        if topic.creator_id != current_user.user_id and current_user.role_id != 1:
            raise HTTPException(status_code=403, detail="Only topic creator can submit for review")
    elif new_status == TopicStatus.APPROVED.value:
        # Only Head of Dept or Admin can approve
        if current_user.role_id not in [1, 3]:  # Admin or Head of Dept
            raise HTTPException(status_code=403, detail="Only Head of Department can approve topics")

    topic.status = new_status
    await db.commit()
    await db.refresh(topic)
    return topic
