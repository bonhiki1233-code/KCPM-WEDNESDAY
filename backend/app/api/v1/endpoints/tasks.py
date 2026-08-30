"""API endpoints for Task Board - BE-TASK-01."""
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.all_models import Task, Team, TeamMember, User
from app.schemas.task import (
    TaskCreate,
    TaskResponse,
    TaskStatus,
    TaskUpdate,
)

router = APIRouter()


async def check_team_membership(db: AsyncSession, user: User, team_id: int) -> TeamMember:
    """Check if user is a member of the team. Returns membership or raises 403."""
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .where(TeamMember.student_id == user.user_id)
        .where(TeamMember.is_active == True)
    )
    membership = result.scalars().first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )
    return membership


async def validate_team_exists(db: AsyncSession, team_id: int) -> Team:
    """Validate that team exists. Returns team or raises 404."""
    result = await db.execute(select(Team).where(Team.team_id == team_id))
    team = result.scalars().first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with id {team_id} not found"
        )
    return team


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    *,
    db: AsyncSession = Depends(deps.get_db),
    task_in: TaskCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new task.
    Only team members can create tasks for their team.
    Initial status is TODO.
    """
    # FIX BUG-02 & BUG-03: Validate team exists
    await validate_team_exists(db, task_in.team_id)
    
    # FIX BUG-01: Check team membership (unless admin/lecturer)
    if current_user.role_id == 5:  # Student
        await check_team_membership(db, current_user, task_in.team_id)
    
    task = Task(
        title=task_in.title,
        description=task_in.description,
        team_id=task_in.team_id,
        sprint_id=task_in.sprint_id,
        assignee_id=task_in.assignee_id,
        priority=task_in.priority.value if task_in.priority else "MEDIUM",
        status=TaskStatus.TODO.value,
        due_date=task_in.due_date,
    )

    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    team_id: Optional[int] = Query(None),
    sprint_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    assignee_id: Optional[UUID] = Query(None),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    List tasks.
    - Students: Only see tasks from their teams
    - Lecturers/Admin: Can see all tasks (with optional team_id filter)
    """
    query = select(Task)

    # FIX BUG-06: Students can only see tasks from their teams
    if current_user.role_id == 5:  # Student
        # Get all teams the student is a member of
        team_ids_result = await db.execute(
            select(TeamMember.team_id)
            .where(TeamMember.student_id == current_user.user_id)
            .where(TeamMember.is_active == True)
        )
        user_team_ids = [t[0] for t in team_ids_result.fetchall()]
        
        if not user_team_ids:
            return []  # No teams, no tasks
        
        if team_id:
            # Verify student is in the requested team
            if team_id not in user_team_ids:
                raise HTTPException(status_code=403, detail="You are not a member of this team")
            query = query.where(Task.team_id == team_id)
        else:
            query = query.where(Task.team_id.in_(user_team_ids))
    elif team_id:
        query = query.where(Task.team_id == team_id)

    if sprint_id:
        query = query.where(Task.sprint_id == sprint_id)

    if status_filter:
        query = query.where(Task.status == status_filter.upper())

    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get task by ID."""
    result = await db.execute(select(Task).where(Task.task_id == task_id))
    task = result.scalars().first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # FIX BUG-06: Students can only see tasks from their teams
    if current_user.role_id == 5:
        membership = await db.execute(
            select(TeamMember)
            .where(TeamMember.team_id == task.team_id)
            .where(TeamMember.student_id == current_user.user_id)
            .where(TeamMember.is_active == True)
        )
        if not membership.scalars().first():
            raise HTTPException(status_code=403, detail="You cannot view this task")

    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update task.
    - Only team members can update tasks
    - Status transitions: TODO <-> DOING <-> DONE
    """
    result = await db.execute(select(Task).where(Task.task_id == task_id))
    task = result.scalars().first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # FIX BUG-01: Check authorization
    if current_user.role_id == 5:  # Student
        await check_team_membership(db, current_user, task.team_id)

    # Handle status transition validation
    if task_in.status:
        current_status = task.status
        new_status = task_in.status.value

        valid_transitions = {
            TaskStatus.TODO.value: [TaskStatus.DOING.value],
            TaskStatus.DOING.value: [TaskStatus.TODO.value, TaskStatus.DONE.value],
            TaskStatus.DONE.value: [TaskStatus.DOING.value],
        }

        allowed = valid_transitions.get(current_status, [])
        if new_status != current_status and new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status} to {new_status}",
            )

    # Update fields
    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value:
            setattr(task, field, value.value)
        elif field == "priority" and value:
            setattr(task, field, value.value)
        else:
            setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """
    Delete task.
    Only team leader or admin can delete tasks.
    """
    result = await db.execute(select(Task).where(Task.task_id == task_id))
    task = result.scalars().first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # FIX BUG-01: Check authorization - only leader or admin can delete
    if current_user.role_id == 5:  # Student
        membership = await check_team_membership(db, current_user, task.team_id)
        if membership.role != "Leader":
            raise HTTPException(
                status_code=403, 
                detail="Only team leader can delete tasks"
            )

    await db.delete(task)
    await db.commit()
