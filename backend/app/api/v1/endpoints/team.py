"""
FastAPI endpoints for Team Formation management.
Ticket: BE-TEAM-01

Features:
- Student creates team (becomes leader)
- Student joins team via join_code
- Leader invites student by email
- Leader removes member
- Student leaves team
- Lecturer locks/finalizes team
- Assign project to team
"""
from typing import List, Optional
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.all_models import Team, TeamMember, User, ClassEnrollment, Project
from app.schemas.team import (
    TeamCreate,
    TeamResponse,
    TeamUpdate,
    TeamMemberCreate,
    TeamMemberResponse,
    TeamMemberUpdate,
    TeamJoinRequest,
    TeamInviteRequest,
    TeamLockRequest,
    TeamAssignProjectRequest,
    UserMinimal,
)

router = APIRouter()


def _generate_join_code(length: int = 8) -> str:
    """Generate a random alphanumeric join code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _get_team_with_members(db: AsyncSession, team_id: int) -> TeamResponse:
    """Helper to build TeamResponse with members."""
    result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get members
    members_result = await db.execute(
        select(User)
        .join(TeamMember, and_(
            TeamMember.student_id == User.user_id,
            TeamMember.team_id == team_id,
            TeamMember.is_active == True
        ))
    )
    members = [UserMinimal.model_validate(u) for u in members_result.scalars().all()]
    
    return TeamResponse(
        team_id=team.team_id,
        project_id=team.project_id,
        leader_id=team.leader_id,
        class_id=team.class_id,
        team_name=team.team_name,
        join_code=team.join_code,
        created_at=team.created_at,
        members=members,
    )


# ==========================================
# TEAM CRUD ENDPOINTS
# ==========================================

@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Create a new Team.
    Only Students can create teams.
    The creator automatically becomes the team leader.
    """
    if current_user.role.role_name.upper() != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can create teams"
        )
    
    # Check if student is enrolled in the class
    enrollment_result = await db.execute(
        select(ClassEnrollment).where(
            ClassEnrollment.class_id == payload.class_id,
            ClassEnrollment.student_id == current_user.user_id
        )
    )
    if not enrollment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be enrolled in this class to create a team"
        )
    
    # Check if student is already in a team for this class
    existing_team = await db.execute(
        select(TeamMember)
        .join(Team, Team.team_id == TeamMember.team_id)
        .where(
            Team.class_id == payload.class_id,
            TeamMember.student_id == current_user.user_id,
            TeamMember.is_active == True
        )
    )
    if existing_team.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already in a team for this class"
        )
    
    # Generate join code
    join_code = _generate_join_code()
    
    # Create team with current user as leader
    team = Team(
        project_id=payload.project_id,
        leader_id=current_user.user_id,
        class_id=payload.class_id,
        team_name=payload.team_name,
        join_code=join_code,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)
    
    # Add leader as team member
    member = TeamMember(
        team_id=team.team_id,
        student_id=current_user.user_id,
        role="leader",
        is_active=True,
    )
    db.add(member)
    await db.commit()
    
    return await _get_team_with_members(db, team.team_id)


@router.get("/", response_model=List[TeamResponse])
async def list_teams(
    class_id: Optional[int] = Query(None, description="Filter by class"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """List all teams, optionally filtered by class."""
    query = select(Team)
    if class_id is not None:
        query = query.where(Team.class_id == class_id)
    
    result = await db.execute(query)
    teams = result.scalars().all()
    
    response = []
    for team in teams:
        members_result = await db.execute(
            select(User)
            .join(TeamMember, and_(
                TeamMember.student_id == User.user_id,
                TeamMember.team_id == team.team_id,
                TeamMember.is_active == True
            ))
        )
        members = [UserMinimal.model_validate(u) for u in members_result.scalars().all()]
        
        response.append(TeamResponse(
            team_id=team.team_id,
            project_id=team.project_id,
            leader_id=team.leader_id,
            class_id=team.class_id,
            team_name=team.team_name,
            join_code=team.join_code,
            created_at=team.created_at,
            members=members,
        ))
    
    return response


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get team details by ID."""
    return await _get_team_with_members(db, team_id)


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: int,
    payload: TeamUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update team details.
    Only the team leader can update.
    """
    result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team.leader_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can update team details"
        )
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)
    
    await db.commit()
    await db.refresh(team)
    
    return await _get_team_with_members(db, team_id)


# ==========================================
# JOIN & INVITE ENDPOINTS
# ==========================================

@router.post("/join", response_model=TeamResponse)
async def join_team_by_code(
    payload: TeamJoinRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Join a team using join code.
    Only Students can join teams.
    """
    if current_user.role.role_name.upper() != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can join teams"
        )
    
    # Find team by join code
    result = await db.execute(
        select(Team).where(Team.join_code == payload.join_code)
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid join code"
        )
    
    if not team.join_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team is closed for joining (locked)"
        )
    
    # Check if student is enrolled in the class
    enrollment_result = await db.execute(
        select(ClassEnrollment).where(
            ClassEnrollment.class_id == team.class_id,
            ClassEnrollment.student_id == current_user.user_id
        )
    )
    if not enrollment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be enrolled in this class to join this team"
        )
    
    # Check if already a member
    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.team_id,
            TeamMember.student_id == current_user.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this team"
        )
    
    # Check if student is already in another team for this class
    other_team = await db.execute(
        select(TeamMember)
        .join(Team, Team.team_id == TeamMember.team_id)
        .where(
            Team.class_id == team.class_id,
            TeamMember.student_id == current_user.user_id,
            TeamMember.is_active == True
        )
    )
    if other_team.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already in another team for this class"
        )
    
    # Add member
    member = TeamMember(
        team_id=team.team_id,
        student_id=current_user.user_id,
        role="member",
        is_active=True,
    )
    db.add(member)
    await db.commit()
    
    return await _get_team_with_members(db, team.team_id)


@router.post("/{team_id}/invite", response_model=TeamMemberResponse)
async def invite_student(
    team_id: int,
    payload: TeamInviteRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Invite a student to the team by email.
    Only the team leader can invite.
    """
    # Get team
    team_result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    team = team_result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team.leader_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can invite members"
        )
    
    if not team.join_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team is locked, cannot invite new members"
        )
    
    # Find student by email
    student_result = await db.execute(
        select(User).where(User.email == payload.student_email)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found with this email"
        )
    
    # Check if student is enrolled
    enrollment_result = await db.execute(
        select(ClassEnrollment).where(
            ClassEnrollment.class_id == team.class_id,
            ClassEnrollment.student_id == student.user_id
        )
    )
    if not enrollment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is not enrolled in this class"
        )
    
    # Check if already a member
    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.student_id == student.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is already a member of this team"
        )
    
    # Add member
    member = TeamMember(
        team_id=team_id,
        student_id=student.user_id,
        role=payload.role or "member",
        is_active=True,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    
    return TeamMemberResponse(
        team_id=member.team_id,
        student_id=member.student_id,
        role=member.role,
        is_active=member.is_active,
        joined_at=member.joined_at,
        student_name=student.full_name,
        student_email=student.email,
    )


# ==========================================
# LEAVE & REMOVE ENDPOINTS
# ==========================================

@router.post("/{team_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_team(
    team_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Leave a team.
    Leaders cannot leave (must transfer leadership first or delete team).
    """
    team_result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    team = team_result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team.leader_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team leader cannot leave. Transfer leadership or delete the team."
        )
    
    if not team.join_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team is locked, cannot leave"
        )
    
    # Find membership
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.student_id == current_user.user_id
        )
    )
    member = member_result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a member of this team"
        )
    
    await db.delete(member)
    await db.commit()
    return None


@router.delete("/{team_id}/members/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    team_id: int,
    student_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Remove a member from the team.
    Only the team leader can remove members.
    """
    from uuid import UUID
    student_uuid = UUID(student_id)
    
    team_result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    team = team_result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team.leader_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can remove members"
        )
    
    if student_uuid == team.leader_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the team leader"
        )
    
    if not team.join_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team is locked, cannot remove members"
        )
    
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.student_id == student_uuid
        )
    )
    member = member_result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this team"
        )
    
    await db.delete(member)
    await db.commit()
    return None


# ==========================================
# LECTURER MANAGEMENT ENDPOINTS
# ==========================================

@router.post("/{team_id}/lock", response_model=TeamResponse)
async def lock_team(
    team_id: int,
    payload: TeamLockRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Lock or unlock a team.
    Only Lecturers can lock/unlock teams.
    When locked, join_code is set to None (no more joining).
    """
    if current_user.role.role_name.upper() != "LECTURER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can lock/unlock teams"
        )
    
    result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if payload.is_locked:
        # Lock: remove join code
        team.join_code = None
    else:
        # Unlock: regenerate join code
        team.join_code = _generate_join_code()
    
    await db.commit()
    await db.refresh(team)
    
    return await _get_team_with_members(db, team_id)


@router.post("/{team_id}/assign-project", response_model=TeamResponse)
async def assign_project(
    team_id: int,
    payload: TeamAssignProjectRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Assign a project to a team.
    Only Lecturers or the Team Leader can assign projects.
    """
    user_role = current_user.role.role_name.upper()
    
    result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check permission
    if user_role != "LECTURER" and team.leader_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers or team leader can assign projects"
        )
    
    # Verify project exists
    project_result = await db.execute(
        select(Project).where(Project.project_id == payload.project_id)
    )
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Verify project is for the same class
    if project.class_id != team.class_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project must be from the same class as the team"
        )
    
    team.project_id = payload.project_id
    await db.commit()
    await db.refresh(team)
    
    return await _get_team_with_members(db, team_id)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete a team.
    Only the team leader or lecturer can delete.
    """
    result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    user_role = current_user.role.role_name.upper()
    if user_role != "LECTURER" and team.leader_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader or lecturer can delete teams"
        )
    
    await db.delete(team)
    await db.commit()
    return None


# ==========================================
# TEAM MEMBERS LIST
# ==========================================

@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    team_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all members of a team."""
    # Verify team exists
    team_result = await db.execute(
        select(Team).where(Team.team_id == team_id)
    )
    if not team_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get members with user info
    result = await db.execute(
        select(TeamMember, User)
        .join(User, User.user_id == TeamMember.student_id)
        .where(TeamMember.team_id == team_id)
    )
    
    members = []
    for member, user in result.all():
        members.append(TeamMemberResponse(
            team_id=member.team_id,
            student_id=member.student_id,
            role=member.role,
            is_active=member.is_active,
            joined_at=member.joined_at,
            student_name=user.full_name,
            student_email=user.email,
        ))
    
    return members
