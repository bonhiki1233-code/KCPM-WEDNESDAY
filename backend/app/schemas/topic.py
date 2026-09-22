"""Topic schemas for request/response validation."""

from pydantic import BaseModel, Field, constr
from typing import Optional
from datetime import datetime
from uuid import UUID

class TopicCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, pattern=r'^[\w\s\-.,!?]+$')
    description: Optional[str] = None
    requirements: str = Field(..., min_length=1, max_length=1000, pattern=r'^[\w\s\-.,!?\n]+$')
    objectives: Optional[str] = None
    tech_stack: Optional[str] = None
    team_size: int = Field(5, ge=5, le=6)

class TopicUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    objectives: Optional[str] = None
    tech_stack: Optional[str] = None

class TopicResponse(BaseModel):
    topic_id: int
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    objectives: Optional[str] = None
    tech_stack: Optional[str] = None
    status: Optional[str] = None
    created_by: Optional[str] = None
    creator_id: Optional[UUID] = None
    dept_id: Optional[int] = None
    created_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EvaluationCreate(BaseModel):
    team_id: int
    project_id: int
    score: float
    feedback: Optional[str] = None

class EvaluationResponse(BaseModel):
    evaluation_id: int
    team_id: int
    topic_id: int
    score: float
    feedback: Optional[str] = None
    evaluator: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
