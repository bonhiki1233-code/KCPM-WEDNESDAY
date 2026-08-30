"""Schemas for Submission operations."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import UUID


# ==========================================
# BASE SCHEMAS
# ==========================================

class SubmissionBase(BaseModel):
    """Base schema for Submission."""
    content: str = Field(..., min_length=1, description="Submission content")
    file_url: Optional[str] = Field(None, description="URL to uploaded file")


# ==========================================
# CREATE SCHEMAS
# ==========================================

class SubmissionCreate(BaseModel):
    """Schema for creating a submission."""
    checkpoint_id: Optional[int] = Field(None, gt=0, description="Checkpoint ID")
    team_id: int = Field(..., gt=0, description="Team ID")
    content: str = Field(..., min_length=1, description="Submission content/description")
    file_url: Optional[str] = Field(None, description="Link to uploaded file")

    @field_validator('file_url')
    @classmethod
    def validate_file_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate file URL format."""
        if v and not v.startswith(('http://', 'https://', 's3://')):
            raise ValueError('Invalid file URL format. Must start with http://, https://, or s3://')
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "team_id": 5,
                "content": "Project proposal document with detailed requirements analysis",
                "file_url": "https://storage.example.com/submissions/proposal_v1.pdf"
            }
        }
    )


# ==========================================
# UPDATE SCHEMAS
# ==========================================

class SubmissionUpdate(BaseModel):
    """Schema for updating a submission (before deadline)."""
    content: Optional[str] = Field(None, min_length=1, description="Updated content")
    file_url: Optional[str] = Field(None, description="Updated file URL")

    @field_validator('file_url')
    @classmethod
    def validate_file_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate file URL format."""
        if v and not v.startswith(('http://', 'https://', 's3://')):
            raise ValueError('Invalid file URL format')
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content": "Updated project proposal with additional sections",
                "file_url": "https://storage.example.com/submissions/proposal_v2.pdf"
            }
        }
    )


class SubmissionGrade(BaseModel):
    """Schema for grading a submission (lecturer only)."""
    total_score: float = Field(..., ge=0, le=100, description="Total score (0-100)")
    feedback: Optional[str] = Field(None, description="Detailed feedback from evaluator")
    allow_late: bool = Field(False, description="Allow late submission for this team")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_score": 85.5,
                "feedback": "Good work on the analysis. Could improve on the technical implementation details.",
                "allow_late": False
            }
        }
    )


# ==========================================
# RESPONSE SCHEMAS
# ==========================================

class SubmissionResponse(SubmissionBase):
    """Response schema for Submission."""
    submission_id: int
    checkpoint_id: int
    submitted_by: UUID
    submitted_at: datetime
    is_late: bool = False

    model_config = ConfigDict(from_attributes=True)


class SubmissionWithEvaluation(SubmissionResponse):
    """Response schema for Submission with evaluation details."""
    evaluation: Optional["EvaluationResponse"] = None

    model_config = ConfigDict(from_attributes=True)


class EvaluationResponse(BaseModel):
    """Response schema for Evaluation."""
    evaluation_id: int
    submission_id: int
    evaluator_id: UUID
    total_score: Optional[float]
    feedback: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubmissionListResponse(BaseModel):
    """Response schema for listing submissions."""
    submission_id: int
    checkpoint_id: int
    submitted_by: UUID
    submitted_at: datetime
    is_late: bool = False
    has_evaluation: bool = False

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# QUERY PARAMETERS
# ==========================================

class SubmissionQueryParams(BaseModel):
    """Query parameters for submission listing."""
    checkpoint_id: Optional[int] = Field(None, description="Filter by checkpoint ID")
    team_id: Optional[int] = Field(None, description="Filter by team ID")
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(100, ge=1, le=100, description="Maximum number of records to return")


# ==========================================
# STATISTICS SCHEMAS
# ==========================================

class SubmissionStats(BaseModel):
    """Statistics for submissions."""
    total_submissions: int
    on_time_submissions: int
    late_submissions: int
    graded_submissions: int
    average_score: Optional[float] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_submissions": 25,
                "on_time_submissions": 22,
                "late_submissions": 3,
                "graded_submissions": 20,
                "average_score": 82.5
            }
        }
    )