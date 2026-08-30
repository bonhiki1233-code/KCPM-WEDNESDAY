from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


# ==========================================
# BASE SCHEMAS
# ==========================================

class MilestoneBase(BaseModel):
    """Base schema for Milestone."""
    title: str = Field(..., min_length=1, max_length=255, description="Milestone title")
    description: Optional[str] = Field(None, description="Detailed description of the milestone")
    due_date: datetime = Field(..., description="Deadline for the milestone")


class CheckpointBase(BaseModel):
    """Base schema for Checkpoint."""
    title: str = Field(..., min_length=1, max_length=255, description="Checkpoint title")
    status: Optional[str] = Field("pending", description="Status: pending, in_progress, completed, late")


# ==========================================
# CREATE SCHEMAS
# ==========================================

class MilestoneCreate(BaseModel):
    """Schema for creating a milestone."""
    class_id: int = Field(..., gt=0, description="Academic class ID")
    title: str = Field(..., min_length=1, max_length=255, description="Milestone title")
    description: Optional[str] = Field(None, description="Detailed description")
    due_date: datetime = Field(..., description="Milestone deadline")
    weight: float = Field(1.0, ge=0, le=1, description="Weight in final grade (0-1)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "class_id": 1,
                "title": "Project Proposal",
                "description": "Submit initial project proposal document",
                "due_date": "2026-03-15T23:59:59Z",
                "weight": 0.2
            }
        }
    )


class CheckpointCreate(BaseModel):
    """Schema for creating a checkpoint."""
    milestone_id: int = Field(..., gt=0, description="Milestone ID")
    team_id: int = Field(..., gt=0, description="Team ID")
    title: str = Field(..., min_length=1, max_length=255, description="Checkpoint title")
    status: Optional[str] = Field("pending", description="Initial status")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "milestone_id": 1,
                "team_id": 5,
                "title": "Initial Draft",
                "status": "pending"
            }
        }
    )


# ==========================================
# UPDATE SCHEMAS
# ==========================================

class MilestoneUpdate(BaseModel):
    """Schema for updating a milestone."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    weight: Optional[float] = Field(None, ge=0, le=1)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Updated Project Proposal",
                "due_date": "2026-03-20T23:59:59Z",
                "weight": 0.25
            }
        }
    )


class CheckpointUpdate(BaseModel):
    """Schema for updating a checkpoint."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[str] = Field(None, description="Status: pending, in_progress, completed, late")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "completed"
            }
        }
    )


# ==========================================
# RESPONSE SCHEMAS
# ==========================================

class CheckpointResponse(CheckpointBase):
    """Response schema for Checkpoint."""
    checkpoint_id: int
    milestone_id: int
    team_id: int

    model_config = ConfigDict(from_attributes=True)


class MilestoneResponse(MilestoneBase):
    """Response schema for Milestone."""
    milestone_id: int
    class_id: int
    created_by: UUID
    checkpoints: list[CheckpointResponse] = []

    model_config = ConfigDict(from_attributes=True)


class MilestoneListResponse(BaseModel):
    """Response schema for listing milestones."""
    milestone_id: int
    class_id: int
    title: str
    due_date: datetime
    created_by: UUID
    checkpoint_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CheckpointListResponse(BaseModel):
    """Response schema for listing checkpoints."""
    checkpoint_id: int
    milestone_id: int
    team_id: int
    title: str
    status: str

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# QUERY PARAMETERS
# ==========================================

class MilestoneQueryParams(BaseModel):
    """Query parameters for milestone listing."""
    class_id: Optional[int] = Field(None, description="Filter by class ID")
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(100, ge=1, le=100, description="Maximum number of records to return")