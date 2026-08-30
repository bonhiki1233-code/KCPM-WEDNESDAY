"""
FastAPI endpoints for Project management.
Ticket: BE-PROJ-01

Projects link Topics to Academic Classes.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.all_models import Project, Topic, Team, User
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ProjectDetailResponse,
    TopicResponse,
)

router = APIRouter()


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Create a new Project linking a Topic to an Academic Class.
    Only Lecturers can create projects.
    """
    # Check if user is a lecturer
    if current_user.role.role_name.upper() != "LECTURER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can create projects"
        )
    
    # Verify topic exists and is approved
    topic_result = await db.execute(
        select(Topic).where(Topic.topic_id == payload.topic_id)
    )
    topic = topic_result.scalar_one_or_none()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    if topic.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only create projects from approved topics"
        )
    
    project = Project(
        project_name=payload.project_name,
        topic_id=payload.topic_id,
        class_id=payload.class_id,
        status=payload.status or "active",
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    class_id: Optional[int] = Query(None, description="Filter by class"),
    topic_id: Optional[int] = Query(None, description="Filter by topic"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    List all projects.
    Students can only see active projects.
    """
    query = select(Project)
    
    # Filter by class
    if class_id is not None:
        query = query.where(Project.class_id == class_id)
    
    # Filter by topic
    if topic_id is not None:
        query = query.where(Project.topic_id == topic_id)
    
    # Filter by status
    if status is not None:
        query = query.where(Project.status == status)
    else:
        # Default: hide draft projects for students
        user_role = current_user.role.role_name.upper()
        if user_role == "STUDENT":
            query = query.where(Project.status != "draft")
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get project details including topic info and team count."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.topic).selectinload(Topic.creator))
        .where(Project.project_id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Count teams assigned to this project
    team_count_result = await db.execute(
        select(func.count()).select_from(Team).where(Team.project_id == project_id)
    )
    team_count = team_count_result.scalar() or 0
    
    # Build topic response
    topic_response = None
    if project.topic:
        topic_response = TopicResponse(
            topic_id=project.topic.topic_id,
            title=project.topic.title,
            description=project.topic.description,
            objectives=project.topic.objectives,
            tech_stack=project.topic.tech_stack,
            creator_id=project.topic.creator_id,
            dept_id=project.topic.dept_id,
            status=project.topic.status or "draft",
            created_at=project.topic.created_at,
            creator_name=project.topic.creator.full_name if project.topic.creator else None,
        )
    
    return ProjectDetailResponse(
        project_id=project.project_id,
        project_name=project.project_name,
        topic_id=project.topic_id,
        class_id=project.class_id,
        status=project.status,
        topic=topic_response,
        team_count=team_count,
        has_assigned_team=team_count > 0,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update a project.
    Only Lecturers can update projects.
    """
    if current_user.role.role_name.upper() != "LECTURER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can update projects"
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
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete a project.
    Only Lecturers can delete projects.
    Cannot delete projects with assigned teams.
    """
    if current_user.role.role_name.upper() != "LECTURER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can delete projects"
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
    
    # Check if teams are assigned
    team_count_result = await db.execute(
        select(func.count()).select_from(Team).where(Team.project_id == project_id)
    )
    team_count = team_count_result.scalar() or 0
    
    if team_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete project with {team_count} assigned teams"
        )
    
    await db.delete(project)
    await db.commit()
    return None
