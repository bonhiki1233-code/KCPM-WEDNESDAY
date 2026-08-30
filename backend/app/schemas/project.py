"""Pydantic schemas for Topic and Project."""
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class TopicStatus(str, Enum):
    """Topic status enum."""
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"


# ==================== TOPIC SCHEMAS ====================

class TopicBase(BaseModel):
    """Base schema for Topic."""
    title: Optional[str] = None
    description: Optional[str] = None
    objectives: Optional[str] = None
    tech_stack: Optional[str] = None


class TopicCreate(TopicBase):
    """Schema for creating a Topic."""
    title: str
    dept_id: int


class TopicUpdate(TopicBase):
    """Schema for updating a Topic."""
    pass


class TopicStatusUpdate(BaseModel):
    """Schema for updating Topic status."""
    status: TopicStatus
    
    @field_validator('status', mode='before')
    @classmethod
    def convert_to_uppercase(cls, v):
        if isinstance(v, str):
            return v.upper()
        return v


class TopicResponse(TopicBase):
    """Schema for Topic response."""
    topic_id: int
    creator_id: UUID
    dept_id: int
    status: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== PROJECT SCHEMAS ====================

class ProjectBase(BaseModel):
    """Base schema for Project."""
    project_name: Optional[str] = None


class ProjectCreate(ProjectBase):
    """Schema for creating a Project."""
    topic_id: int
    class_id: int
    project_name: str


class ProjectResponse(ProjectBase):
    """Schema for Project response."""
    project_id: int
    topic_id: int
    class_id: int
    status: Optional[str] = None
    claimed_by_id: Optional[UUID] = None
    claimed_at: Optional[datetime] = None
    topic_title: Optional[str] = None
    topic_description: Optional[str] = None
    proposer_name: Optional[str] = None

    class Config:
        from_attributes = True
