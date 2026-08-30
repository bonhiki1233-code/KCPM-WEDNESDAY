"""Pydantic schemas for Task."""
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class TaskStatus(str, Enum):
    """Task status enum."""
    TODO = "TODO"
    DOING = "DOING"
    REVIEW = "REVIEW"
    DONE = "DONE"


class TaskPriority(str, Enum):
    """Task priority enum."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# ==================== TASK SCHEMAS ====================

class TaskBase(BaseModel):
    """Base schema for Task."""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = "MEDIUM"


class TaskCreate(TaskBase):
    """Schema for creating a Task."""
    title: str
    sprint_id: Optional[int] = None
    description: Optional[str] = None
    status: Optional[str] = "TODO"
    assigned_to: Optional[UUID] = None
    priority: str = "MEDIUM"
    due_date: Optional[datetime] = None
    blocked_reason: Optional[str] = None
    depends_on: Optional[int] = None


class TaskUpdate(BaseModel):
    """Schema for updating a Task."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[UUID] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    blocked_reason: Optional[str] = None
    depends_on: Optional[int] = None
    
    # Enable case-insensitive validator for status and priority if needed
    @field_validator('status', mode='before')
    @classmethod
    def convert_status_to_uppercase(cls, v):
        if isinstance(v, str):
            return v.upper()
        return v
    
    @field_validator('priority', mode='before')
    @classmethod
    def convert_priority_to_uppercase(cls, v):
        if isinstance(v, str):
            return v.upper()
        return v


class TaskResponse(TaskBase):
    """Schema for Task response."""
    task_id: int
    sprint_id: Optional[int] = None
    assigned_to: Optional[UUID] = None
    status: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    blocked_reason: Optional[str] = None
    depends_on: Optional[int] = None
    created_by: Optional[str] = None # Added field for convenience (mapped manually in API)

    class Config:
        from_attributes = True



