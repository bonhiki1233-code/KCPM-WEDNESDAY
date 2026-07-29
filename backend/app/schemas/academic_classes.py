from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class AcademicClassCreate(BaseModel):
    class_code: str
    semester_id: int
    subject_id: int
    lecturer_id: UUID

class AcademicClassUpdate(BaseModel):
    class_code: Optional[str] = None
    semester_id: Optional[int] = None
    subject_id: Optional[int] = None
    lecturer_id: Optional[UUID] = None

class AcademicClassResponse(BaseModel):
    class_id: int
    class_code: str
    semester_id: int
    subject_id: int
    lecturer_id: UUID
    
    class Config:
        from_attributes = True