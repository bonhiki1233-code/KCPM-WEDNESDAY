"""Pydantic schemas for Team and TeamMember."""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel


# ==================== TEAM SCHEMAS ====================

class TeamProjectSelect(BaseModel):
    """Schema for selecting a project for a team."""
    project_id: int


class TeamBase(BaseModel):
    """Base schema for Team."""
    team_name: Optional[str] = None


class TeamCreate(TeamBase):
    """Schema for creating a Team."""
    name: str
    project_id: Optional[int] = None
    description: Optional[str] = None


class TeamJoinByCode(BaseModel):
    """Schema for joining a team by code."""
    join_code: str


class TeamMemberResponse(BaseModel):
    """Schema for TeamMember response."""
    student_id: UUID
    full_name: Optional[str] = None
    email: str
    role: Optional[str] = None
    is_active: bool = True
    joined_at: datetime

    class Config:
        from_attributes = True


class TeamResponse(TeamBase):
    """Schema for Team response."""
    team_id: int
    project_id: Optional[int] = None
    leader_id: Optional[UUID] = None
    class_id: Optional[int] = None
    join_code: Optional[str] = None
    is_finalized: bool = False
    created_at: datetime
    members: List[TeamMemberResponse] = []

    class Config:
        from_attributes = True


class TeamSimpleResponse(TeamBase):
    """Simple Team response without members."""
    team_id: int
    project_id: Optional[int] = None
    leader_id: Optional[UUID] = None
    class_id: Optional[int] = None
    join_code: Optional[str] = None
    is_finalized: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
