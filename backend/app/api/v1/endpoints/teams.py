"""API endpoints for Team Formation - BE-TEAM-01."""
import secrets
import string
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.all_models import AcademicClass, Team, TeamMember, User
from app.schemas.team import (
    TeamCreate,
    TeamJoinByCode,
    TeamMemberResponse,
    TeamResponse,
    TeamSimpleResponse,
)

router = APIRouter()

# FIX BUG-07: Max team members limit
MAX_TEAM_MEMBERS = 6


def generate_join_code(length: int = 8) -> str:
    """Generate a random join code. FIX BUG-08: Increased to 8 chars."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def validate_class_exists(db: AsyncSession, class_id: int) -> AcademicClass:
    """FIX BUG-03: Validate class exists."""
    result = await db.execute(select(AcademicClass).where(AcademicClass.class_id == class_id))
    academic_class = result.scalars().first()
    if not academic_class:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Class with id {class_id} not found"
        )
    return academic_class


@router.post("/", response_model=TeamSimpleResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    *,
    db: AsyncSession = Depends(deps.get_db),
    team_in: TeamCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new team.
    Only Students can create teams. Creator becomes the leader.
    """
    if current_user.role_id != 5:  # Student
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can create teams",
        )
    
    # FIX BUG-03: Validate class exists
    await validate_class_exists(db, team_in.class_id)

    # Check if student is already in a team for this class
    existing_membership = await db.execute(
        select(TeamMember)
        .join(Team)
        .where(Team.class_id == team_in.class_id)
        .where(TeamMember.student_id == current_user.user_id)
        .where(TeamMember.is_active == True)
    )
    if existing_membership.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already in a team for this class",
        )

    # Create team with unique join code
    join_code = generate_join_code()
    team = Team(
        team_name=team_in.team_name,
        class_id=team_in.class_id,
        project_id=team_in.project_id,
        leader_id=current_user.user_id,
        join_code=join_code,
    )

    db.add(team)
    await db.flush()

    # Add creator as first team member with 'Leader' role
    team_member = TeamMember(
        team_id=team.team_id,
        student_id=current_user.user_id,
        role="Leader",
        is_active=True,
    )
    db.add(team_member)

    await db.commit()
    await db.refresh(team)

    # Return with is_finalized = False
    return {**team.__dict__, "is_finalized": False}


@router.get("/", response_model=List[TeamSimpleResponse])
async def list_teams(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    class_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List all teams, optionally filtered by class."""
    query = select(Team)

    if class_id:
        query = query.where(Team.class_id == class_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    teams = result.scalars().all()

    # Add is_finalized field
    return [{**t.__dict__, "is_finalized": t.join_code is None} for t in teams]


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get team by ID with all members."""
    result = await db.execute(
        select(Team)
        .options(selectinload(Team.members).selectinload(TeamMember.student))
        .where(Team.team_id == team_id)
    )
    team = result.scalars().first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Build members list
    members = []
    for tm in team.members:
        if tm.is_active:
            members.append(
                TeamMemberResponse(
                    student_id=tm.student_id,
                    full_name=tm.student.full_name,
                    email=tm.student.email,
                    role=tm.role,
                    is_active=tm.is_active,
                    joined_at=tm.joined_at,
                )
            )

    return TeamResponse(
        team_id=team.team_id,
        team_name=team.team_name,
        project_id=team.project_id,
        leader_id=team.leader_id,
        class_id=team.class_id,
        join_code=team.join_code,
        is_finalized=team.join_code is None,
        created_at=team.created_at,
        members=members,
    )


@router.post("/join", response_model=TeamSimpleResponse)
async def join_team_by_code(
    join_data: TeamJoinByCode,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Join a team using join code.
    Only students can join. Team must not be finalized.
    """
    if current_user.role_id != 5:  # Student
        raise HTTPException(status_code=403, detail="Only students can join teams")

    # Find team by join code (case-insensitive)
    result = await db.execute(
        select(Team).where(Team.join_code == join_data.join_code.upper())
    )
    team = result.scalars().first()

    if not team:
        raise HTTPException(status_code=404, detail="Invalid join code")

    # FIX BUG-05: Check finalized properly - if join_code is None means finalized
    # Note: Since we find by join_code, if found, it's not finalized. But double-check.
    if team.join_code is None:
        raise HTTPException(status_code=400, detail="Team has been finalized, cannot join")

    # Check if already in this team
    existing = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team.team_id)
        .where(TeamMember.student_id == current_user.user_id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="You are already in this team")

    # Check if in another team in same class
    other_team = await db.execute(
        select(TeamMember)
        .join(Team)
        .where(Team.class_id == team.class_id)
        .where(Team.team_id != team.team_id)
        .where(TeamMember.student_id == current_user.user_id)
        .where(TeamMember.is_active == True)
    )
    if other_team.scalars().first():
        raise HTTPException(status_code=400, detail="You are already in another team for this class")

    # FIX BUG-07: Check team member limit
    member_count_result = await db.execute(
        select(func.count(TeamMember.student_id))
        .where(TeamMember.team_id == team.team_id)
        .where(TeamMember.is_active == True)
    )
    member_count = member_count_result.scalar()
    if member_count >= MAX_TEAM_MEMBERS:
        raise HTTPException(
            status_code=400, 
            detail=f"Team is full. Maximum {MAX_TEAM_MEMBERS} members allowed."
        )

    # Add member
    team_member = TeamMember(
        team_id=team.team_id,
        student_id=current_user.user_id,
        role="Member",
        is_active=True,
    )
    db.add(team_member)
    await db.commit()
    await db.refresh(team)

    return {**team.__dict__, "is_finalized": False}


@router.post("/{team_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_team(
    team_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Leave a team. Leader cannot leave (must delete team instead)."""
    result = await db.execute(select(Team).where(Team.team_id == team_id))
    team = result.scalars().first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.join_code is None:
        raise HTTPException(status_code=400, detail="Team has been finalized, cannot leave")

    if team.leader_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Leader cannot leave. Delete the team instead.")

    # Find and deactivate membership
    membership = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .where(TeamMember.student_id == current_user.user_id)
    )
    member = membership.scalars().first()

    if not member:
        raise HTTPException(status_code=400, detail="You are not in this team")

    await db.delete(member)
    await db.commit()


@router.patch("/{team_id}/finalize", response_model=TeamSimpleResponse)
async def finalize_team(
    team_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Finalize team - lock membership.
    Only Lecturers can finalize teams.
    """
    if current_user.role_id not in [1, 4]:  # Admin or Lecturer
        raise HTTPException(status_code=403, detail="Only lecturers can finalize teams")

    result = await db.execute(select(Team).where(Team.team_id == team_id))
    team = result.scalars().first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.join_code is None:
        raise HTTPException(status_code=400, detail="Team is already finalized")

    # Remove join_code to finalize
    team.join_code = None
    await db.commit()
    await db.refresh(team)

    return {**team.__dict__, "is_finalized": True}
