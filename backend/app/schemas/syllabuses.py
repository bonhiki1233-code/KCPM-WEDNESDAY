from pydantic import BaseModel, Field
from typing import Optional

class SyllabusCreate(BaseModel):
    subject_id: int = Field(..., description="ID of the subject")
    description: Optional[str] = Field(None, max_length=1000)
    min_score_to_pass: Optional[int] = Field(None, ge=0, le=100)
    effective_date: Optional[str] = None
    is_active: bool = True

class SyllabusUpdate(BaseModel):
    subject_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=1000)
    min_score_to_pass: Optional[int] = Field(None, ge=0, le=100)
    effective_date: Optional[str] = None
    is_active: Optional[bool] = None

class SyllabusResponse(BaseModel):
    syllabus_id: int
    subject_id: int
    description: Optional[str] = None
    min_score_to_pass: Optional[int] = None
    effective_date: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True

class SyllabusWithSubject(SyllabusResponse):
    subject_code: str
    subject_name: str
    department_name: Optional[str] = None
