"""
FastAPI endpoints for Project management.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.all_models import Project, Topic, Team, User
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    TopicResponse,
)

router = APIRouter()


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new Project linking a Topic to an Academic Class.
    Only Lecturers can create projects.
    """
    # Role check
    if current_user.role_id != 4: # Lecturer
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can create projects"
        )
    
    # Verify topic exists and is approved (Case-insensitive check)
    topic_result = await db.execute(
        select(Topic).where(Topic.topic_id == payload.topic_id)
    )
    topic = topic_result.scalar_one_or_none()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    if topic.status and topic.status.upper() != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only create projects from approved topics. Current: {topic.status}"
        )
    
    project = Project(
        project_name=payload.project_name,
        topic_id=payload.topic_id,
        class_id=payload.class_id,
        status="active",
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    class_id: Optional[int] = Query(None, description="Filter by class"),
    topic_id: Optional[int] = Query(None, description="Filter by topic"),
    claimed_by_me: bool = Query(False, description="Filter projects claimed by current user"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all projects.
    """
    query = (
        select(Project, Topic, User)
        .join(Topic, Project.topic_id == Topic.topic_id)
        .join(User, Topic.creator_id == User.user_id, isouter=True)
    )
    
    if class_id is not None:
        query = query.where(Project.class_id == class_id)
    
    if topic_id is not None:
        query = query.where(Project.topic_id == topic_id)
    
    if claimed_by_me:
        query = query.where(Project.claimed_by_id == current_user.user_id)
    elif current_user.role_id == 5: # Student listing available projects
        query = query.where(Project.claimed_by_id == None)
    
    result = await db.execute(query)
    rows = result.all()

    response_items = []
    for project, topic, creator in rows:
        response_items.append(ProjectResponse(
            project_id=project.project_id,
            topic_id=project.topic_id,
            class_id=project.class_id,
            project_name=project.project_name,
            status=project.status,
            claimed_by_id=project.claimed_by_id,
            claimed_at=project.claimed_at,
            topic_title=topic.title if topic else None,
            topic_description=topic.description if topic else None,
            proposer_name=creator.full_name if creator else None,
        ))

    return response_items


@router.patch("/{project_id}/claim", response_model=ProjectResponse)
async def claim_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Claim a project (Student only).
    """
    # Role check
    if current_user.role_id != 5: # Student
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can claim projects"
        )
    
    result = await db.execute(
        select(Project).where(Project.project_id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check if already claimed
    if project.claimed_by_id:
        if project.claimed_by_id == current_user.user_id:
            return project # Already claimed by current user
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project is already claimed by another student"
        )
        
    # Claim it
    project.claimed_by_id = current_user.user_id
    project.claimed_at = datetime.now(timezone.utc)
    project.status = "claimed"
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get project details."""
    result = await db.execute(
        select(Project)
        .where(Project.project_id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project
