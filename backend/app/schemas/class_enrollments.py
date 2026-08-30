from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class ClassEnrollmentCreate(BaseModel):
    class_id: int
    student_id: UUID

class BulkEnrollmentCreate(BaseModel):
    """Gán nhiều sinh viên vào 1 lớp"""
    class_id: int
    student_ids: List[UUID]  # Danh sách UUID của sinh viên

class ClassEnrollmentUpdate(BaseModel):
    status: Optional[str] = None  # "active", "dropped", "completed"

class ClassEnrollmentResponse(BaseModel):
    enrollment_id: int
    class_id: int
    student_id: UUID
    enrolled_at: datetime
    status: Optional[str] = None
    
    class Config:
        from_attributes = True

class BulkEnrollmentResponse(BaseModel):
    """Response cho bulk enrollment"""
    success_count: int
    failed_count: int
    enrollments: List[ClassEnrollmentResponse]
    errors: List[dict]  # Danh sách lỗi nếu có