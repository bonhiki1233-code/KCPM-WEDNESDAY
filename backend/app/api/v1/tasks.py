"""
BE4 - Tasks & Sprints Endpoints
Author: Backend Dev 4
Created: 2026-01-28

Description:
- Create/manage tasks in sprints
- Status transitions: TODO → DOING → REVIEW → DONE
- Assign tasks to team members
- Simple priority levels (LOW, MEDIUM, HIGH)
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from typing import Optional

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.all_models import User, Sprint, Task, Team, TeamMember
from app.schemas.task import TaskCreate, TaskUpdate

router = APIRouter()

# ============================================================================
# SPRINTS ENDPOINTS
# ============================================================================

@router.post("/sprints", status_code=201)
async def create_sprint(
    team_id: int,
    name: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a sprint for a team
    
    Request Query/Body:
        {
            "team_id": 1,
            "name": "Sprint 1 - Setup",
            "start_date": "2026-01-28",
            "end_date": "2026-02-04"
        }
    
    Response:
        {
            "sprint_id": 1,
            "team_id": 1,
            "name": "Sprint 1",
            "start_date": "2026-01-28",
            "end_date": "2026-02-04",
            "created_at": "2026-01-28T10:00:00"
        }
    """
    
    # Parse dates
    start_date_obj = None
    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")

    end_date_obj = None
    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")

    sprint = Sprint(
        team_id=team_id,
        name=name,
        start_date=start_date_obj,
        end_date=end_date_obj,
        created_by=current_user.user_id,
        created_at=datetime.now(timezone.utc),
    )
    
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    
    return {
        "sprint_id": sprint.sprint_id,
        "team_id": sprint.team_id,
        "name": sprint.name,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "created_at": sprint.created_at
    }


@router.get("/sprints/{sprint_id}")
async def get_sprint_detail(
    sprint_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get sprint details with task counts by status
    
    Response:
        {
            "sprint_id": 1,
            "team_id": 1,
            "name": "Sprint 1",
            "start_date": "2026-01-28",
            "end_date": "2026-02-04",
            "task_counts": {
                "TODO": 5,
                "DOING": 2,
                "DONE": 3,
                "BLOCKED": 1
            },
            "created_at": "2026-01-28T10:00:00"
        }
    """
    
    query = select(Sprint).where(Sprint.sprint_id == sprint_id)
    result = await db.execute(query)
    sprint = result.scalar()
    
    if not sprint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sprint not found"
        )
    
    # Count tasks by status
    tasks_query = select(Task).where(Task.sprint_id == sprint_id)
    tasks_result = await db.execute(tasks_query)
    all_tasks = tasks_result.scalars().all()
    
    task_counts = {
        "TODO": sum(1 for t in all_tasks if t.status == "TODO"),
        "DOING": sum(1 for t in all_tasks if t.status == "DOING"),
        "DONE": sum(1 for t in all_tasks if t.status == "DONE"),
        "BLOCKED": sum(1 for t in all_tasks if t.status == "BLOCKED"),
    }
    
    return {
        "sprint_id": sprint.sprint_id,
        "team_id": sprint.team_id,
        "name": sprint.name,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "task_counts": task_counts,
        "total_tasks": len(all_tasks),
        "created_at": sprint.created_at
    }


@router.get("/teams/{team_id}/sprints")
async def get_team_sprints(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all sprints for a specific team
    
    Response:
        {
            "sprints": [
                {
                    "sprint_id": 1,
                    "team_id": 1,
                    "name": "Sprint 1",
                    "start_date": "2026-01-28",
                    "end_date": "2026-02-04",
                    "created_at": "2026-01-28T10:00:00"
                }
            ],
            "total": 1
        }
    """
    
    # Verify user is a member of the team
    member_query = select(TeamMember).where(
        and_(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.user_id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )
    
    # Get all sprints for the team
    query = select(Sprint).where(Sprint.team_id == team_id).order_by(Sprint.created_at.desc())
    result = await db.execute(query)
    sprints = result.scalars().all()
    
    sprints_response = []
    for sprint in sprints:
        sprints_response.append({
            "sprint_id": sprint.sprint_id,
            "id": sprint.sprint_id,
            "team_id": sprint.team_id,
            "name": sprint.name,
            "start_date": sprint.start_date,
            "end_date": sprint.end_date,
            "created_at": sprint.created_at
        })
    
    return {
        "sprints": sprints_response,
        "total": len(sprints_response)
    }


# ============================================================================
# TASKS ENDPOINTS
# ============================================================================

@router.post("", status_code=201)
async def create_task(
    task: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new task in a sprint
    
    Request:
        {
            "title": "Setup project structure",
            "sprint_id": 1,
            "description": "Create folders and initial files",
            "assigned_to": "student-uuid-1",
            "priority": "HIGH"
        }
    
    Response:
        {
            "task_id": 1,
            "title": "Setup project structure",
            "sprint_id": 1,
            "status": "TODO",
            "priority": "HIGH",
            "assigned_to": "student-uuid-1",
            "created_by": "student@example.com",
            "created_at": "2026-01-28T10:00:00"
        }
    """
    
    new_task = Task(
        title=task.title,
        sprint_id=task.sprint_id,
        description=task.description,
        status=task.status or "TODO",
        priority=task.priority or "MEDIUM",
        assigned_to=task.assigned_to,
        created_by=current_user.user_id,
        created_at=datetime.now(timezone.utc),
        blocked_reason=task.blocked_reason,
        depends_on=task.depends_on,
        due_date=task.due_date,
    )
    
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    
    # Get assigned user name if applicable
    assigned_name = None
    if new_task.assigned_to:
        user_query = select(User).where(User.user_id == new_task.assigned_to)
        user_result = await db.execute(user_query)
        assigned_user = user_result.scalar()
        assigned_name = assigned_user.full_name if assigned_user else None
    
    return {
        "task_id": new_task.task_id,
        "title": new_task.title,
        "sprint_id": new_task.sprint_id,
        "description": new_task.description,
        "status": new_task.status,
        "priority": new_task.priority,
        "assigned_to": assigned_name,
        "created_by": current_user.full_name,
        "created_at": new_task.created_at,
        "blocked_reason": new_task.blocked_reason,
        "depends_on": new_task.depends_on,
        "due_date": new_task.due_date
    }


@router.get("")
async def get_tasks(
    sprint_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all tasks (optionally filter by sprint_id or status)
    
    Query params:
        ?sprint_id=1&status=TODO
    
    Response:
        {
            "tasks": [
                {
                    "task_id": 1,
                    "title": "Setup project",
                    "sprint_id": 1,
                    "status": "TODO",
                    "priority": "HIGH",
                    "assigned_to": "John Doe",
                    "created_by": "Jane Smith"
                },
                ...
            ],
            "total": 5
        }
    """
    
    # Start with base query - use outerjoin to handle tasks without sprints/teams
    from sqlalchemy.orm import outerjoin
    query = select(Task).outerjoin(Sprint, Task.sprint_id == Sprint.sprint_id) \
                        .outerjoin(Team, Sprint.team_id == Team.team_id) \
                        .outerjoin(TeamMember, and_(
                            Team.team_id == TeamMember.team_id,
                            TeamMember.user_id == current_user.user_id
                        )) \
                        .where(
                            # Include tasks that either:
                            # 1. Have no sprint (orphaned tasks created by this user)
                            # 2. Belong to a team where user is a member
                            (Task.sprint_id == None) | 
                            (TeamMember.user_id == current_user.user_id)
                        )
    
    # Filter by sprint
    if sprint_id:
        query = query.where(Task.sprint_id == sprint_id)
    
    # Filter by status
    if status:
        valid_statuses = ["TODO", "DOING", "DONE", "BLOCKED"]
        if status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status must be one of: {valid_statuses}"
            )
        query = query.where(Task.status == status)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    tasks_response = []
    for t in tasks:
        # Get assigned user name
        assigned_name = None
        if t.assigned_to:
            user_query = select(User).where(User.user_id == t.assigned_to)
            user_result = await db.execute(user_query)
            assigned_user = user_result.scalar()
            assigned_name = assigned_user.full_name if assigned_user else None
        
        # Get creator name
        creator_query = select(User).where(User.user_id == t.created_by)
        creator_result = await db.execute(creator_query)
        creator = creator_result.scalar()
        
        tasks_response.append({
            "task_id": t.task_id,
            "title": t.title,
            "sprint_id": t.sprint_id,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "assigned_to": assigned_name,
            "created_by": creator.full_name if creator else "Unknown",
            "created_at": t.created_at,
            "due_date": t.due_date
        })
    
    return {
        "tasks": tasks_response,
        "total": len(tasks_response)
    }


@router.get("/{task_id}")
async def get_task_detail(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get task details
    
    Response:
        {
            "task_id": 1,
            "title": "Setup project",
            "sprint_id": 1,
            "description": "...",
            "status": "TODO",
            "priority": "HIGH",
            "assigned_to": "John Doe",
            "created_by": "Jane Smith",
            "created_at": "2026-01-28T10:00:00",
            "updated_at": "2026-01-28T10:00:00"
        }
    """
    
    query = select(Task).where(Task.task_id == task_id)
    result = await db.execute(query)
    task = result.scalar()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Get assigned user name
    assigned_name = None
    if task.assigned_to:
        user_query = select(User).where(User.user_id == task.assigned_to)
        user_result = await db.execute(user_query)
        assigned_user = user_result.scalar()
        assigned_name = assigned_user.full_name if assigned_user else None
    
    # Get creator name
    creator_query = select(User).where(User.user_id == task.created_by)
    creator_result = await db.execute(creator_query)
    creator = creator_result.scalar()
    
    return {
        "task_id": task.task_id,
        "title": task.title,
        "sprint_id": task.sprint_id,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assigned_to": assigned_name,
        "created_by": creator.full_name if creator else "Unknown",
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "blocked_reason": task.blocked_reason,
        "depends_on": task.depends_on,
        "due_date": task.due_date
    }


@router.put("/{task_id}", status_code=200)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update task details (title, description, status, priority, assigned_to)
    - Status must be one of: TODO, DOING, DONE, BLOCKED
    
    Request:
        {
            "title": "Setup project structure",
            "status": "DOING",
            "priority": "HIGH",
            "assigned_to": "student-uuid-1"
        }
    
    Response:
        {
            "task_id": 1,
            "title": "Setup project structure",
            "status": "DOING",
            "priority": "HIGH",
            "assigned_to": "John Doe",
            "updated_at": "2026-01-28T10:30:00"
        }
    """
    
    # Get task
    query = select(Task).where(Task.task_id == task_id)
    result = await db.execute(query)
    task = result.scalar()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Update fields if provided
    if task_update.title is not None:
        task.title = task_update.title
    
    if task_update.description is not None:
        task.description = task_update.description
    
    # Validate status
    if task_update.status is not None:
        valid_statuses = ["TODO", "DOING", "DONE", "BLOCKED"]
        if task_update.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status must be one of: {valid_statuses}"
            )
        task.status = task_update.status
    
    if task_update.priority is not None:
        task.priority = task_update.priority
    
    if task_update.assigned_to is not None:
        task.assigned_to = task_update.assigned_to
    
    if task_update.blocked_reason is not None:
        task.blocked_reason = task_update.blocked_reason
        
    if task_update.depends_on is not None:
        task.depends_on = task_update.depends_on
        
    if task_update.due_date is not None:
        task.due_date = task_update.due_date
    
    # Update timestamp
    task.updated_at = datetime.now(timezone.utc)
    
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    # Get assigned user name
    assigned_name = None
    if task.assigned_to:
        user_query = select(User).where(User.user_id == task.assigned_to)
        user_result = await db.execute(user_query)
        assigned_user = user_result.scalar()
        assigned_name = assigned_user.full_name if assigned_user else None
    
    return {
        "task_id": task.task_id,
        "title": task.title,
        "sprint_id": task.sprint_id,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assigned_to": assigned_name,
        "updated_at": task.updated_at,
        "blocked_reason": task.blocked_reason,
        "depends_on": task.depends_on,
        "due_date": task.due_date
    }


@router.delete("/{task_id}", status_code=200)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a task
    
    Response:
        {
            "task_id": 1,
            "message": "Task deleted successfully"
        }
    """
    
    # Get task
    query = select(Task).where(Task.task_id == task_id)
    result = await db.execute(query)
    task = result.scalar()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Delete
    await db.delete(task)
    await db.commit()
    
    return {
        "task_id": task_id,
        "message": "Task deleted successfully"
    }


# ============================================================================
# STATUS TRANSITION VALIDATION
# ============================================================================

# Valid status transitions map
# Valid status transitions map
# Key = current status, Value = list of allowed next statuses
STATUS_TRANSITIONS = {
    "TODO": ["DOING", "DONE"],
    "DOING": ["TODO", "REVIEW", "DONE"],
    "REVIEW": ["DONE", "DOING", "TODO"],
    "DONE": ["REVIEW", "DOING", "TODO"], 
}

def validate_status_transition(current_status: str, new_status: str) -> bool:
    """Check if status transition is valid."""
    current = current_status.upper()
    new = new_status.upper()
    
    if current not in STATUS_TRANSITIONS:
        return False
    
    allowed = STATUS_TRANSITIONS.get(current, [])
    return new in allowed


# ============================================================================
# NEW ENDPOINTS: Sprint Tasks, Status Change, Assignment
# ============================================================================

@router.get("/sprints/{sprint_id}/tasks")
async def get_sprint_tasks(
    sprint_id: int,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all tasks in a sprint with optional status filter.
    
    Query params:
        ?status_filter=DOING
    
    Response:
        {
            "sprint_id": 1,
            "tasks": [...],
            "total": 5
        }
    """
    # Verify sprint exists
    sprint_query = select(Sprint).where(Sprint.sprint_id == sprint_id)
    sprint_result = await db.execute(sprint_query)
    sprint = sprint_result.scalar()
    
    if not sprint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sprint not found"
        )
    
    # Verify user is a member of the team that owns this sprint
    if sprint.team_id:
        member_query = select(TeamMember).where(
            and_(
                TeamMember.team_id == sprint.team_id,
                TeamMember.user_id == current_user.user_id
            )
        )
        member_result = await db.execute(member_query)
        member = member_result.scalar()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this team"
            )
    
    
    # Build query
    query = select(Task).where(Task.sprint_id == sprint_id)
    
    if status_filter:
        query = query.where(Task.status == status_filter.upper())
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    tasks_response = []
    for t in tasks:
        # Get assigned user name
        assigned_name = None
        if t.assigned_to:
            user_query = select(User).where(User.user_id == t.assigned_to)
            user_result = await db.execute(user_query)
            assigned_user = user_result.scalar()
            assigned_name = assigned_user.full_name if assigned_user else None
        
        tasks_response.append({
            "task_id": t.task_id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "assigned_to": assigned_name,
            "created_at": t.created_at,
            "due_date": t.due_date
        })
    
    return {
        "sprint_id": sprint_id,
        "tasks": tasks_response,
        "total": len(tasks_response)
    }


@router.patch("/{task_id}/status", status_code=200)
async def change_task_status(
    task_id: int,
    new_status: str,
    blocked_reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Change task status with validation.
    
    Valid transitions:
        TODO → DOING
        DOING → REVIEW | TODO
        REVIEW → DONE | DOING
        DONE → REVIEW
    
    Request:
        ?new_status=DOING&blocked_reason=Waiting%20for%20API
    
    Response:
        {
            "task_id": 1,
            "old_status": "TODO",
            "new_status": "DOING",
            "updated_at": "..."
        }
    """
    # Get task
    query = select(Task).where(Task.task_id == task_id)
    result = await db.execute(query)
    task = result.scalar()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    old_status = task.status or "TODO"
    new_status_upper = new_status.upper()
    
    # Validate transition
    if not validate_status_transition(old_status, new_status_upper):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status transition: {old_status} → {new_status_upper}"
        )
    
    
    # If moving to DONE, check dependencies
    if new_status_upper == "DONE" and task.depends_on:
        dep_query = select(Task).where(Task.task_id == task.depends_on)
        dep_result = await db.execute(dep_query)
        dep_task = dep_result.scalar()
        if dep_task and dep_task.status != "DONE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete task. Dependency task {task.depends_on} is not DONE."
            )

    # Update
    task.status = new_status_upper
    task.updated_at = datetime.now(timezone.utc)
    if blocked_reason is not None:
        task.blocked_reason = blocked_reason
    
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    return {
        "task_id": task.task_id,
        "old_status": old_status,
        "new_status": task.status,
        "updated_at": task.updated_at
    }


from uuid import UUID as PyUUID

@router.patch("/{task_id}/assign", status_code=200)
async def assign_task(
    task_id: int,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Assign task to a team member.
    Validates that the user is a member of the team that owns the sprint.
    
    Request:
        ?user_id=<uuid>
    
    Response:
        {
            "task_id": 1,
            "assigned_to": "John Doe",
            "updated_at": "..."
        }
    """
    # Get task
    query = select(Task).where(Task.task_id == task_id)
    result = await db.execute(query)
    task = result.scalar()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Get sprint to find team_id
    sprint_query = select(Sprint).where(Sprint.sprint_id == task.sprint_id)
    sprint_result = await db.execute(sprint_query)
    sprint = sprint_result.scalar()
    
    if not sprint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task is not associated with a sprint"
        )
    
    # Convert user_id string to UUID
    try:
        target_user_id = PyUUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format"
        )
    
    # Check if user is a team member
    member_query = select(TeamMember).where(
        and_(
            TeamMember.team_id == sprint.team_id,
            TeamMember.user_id == target_user_id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a member of the team"
        )
    
    # Assign
    task.assigned_to = target_user_id
    task.updated_at = datetime.now(timezone.utc)
    
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    # Get assigned user name
    user_query = select(User).where(User.user_id == target_user_id)
    user_result = await db.execute(user_query)
    assigned_user = user_result.scalar()
    
    return {
        "task_id": task.task_id,
        "assigned_to": assigned_user.full_name if assigned_user else str(target_user_id),
        "updated_at": task.updated_at
    }

