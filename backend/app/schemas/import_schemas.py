"""
Pydantic schemas for bulk import features (Subjects, Classes, Users).
"""
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


# ==========================================
# SUBJECT IMPORT SCHEMAS
# ==========================================

class SubjectImportRow(BaseModel):
    """Schema for a single subject row in import file."""
    subject_code: str = Field(..., min_length=1, max_length=50, description="Subject code (must be unique)")
    subject_name: str = Field(..., min_length=1, max_length=255, description="Subject name")
    credits: int = Field(..., ge=1, le=10, description="Credit units (1-10)")
    dept_name: str = Field(..., description="Department name (must exist in database)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "subject_code": "IT101",
                "subject_name": "Lập Trình Python",
                "credits": 4,
                "dept_name": "Software Engineering"
            }
        }


class SubjectImportResultRow(BaseModel):
    """Result for a single imported subject."""
    row_number: int
    subject_code: str
    status: str  # "success", "error", "skipped"
    subject_id: Optional[int] = None
    message: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "row_number": 1,
                "subject_code": "IT101",
                "status": "success",
                "subject_id": 42,
                "message": "Subject created successfully"
            }
        }


class SubjectImportResponse(BaseModel):
    """Response for bulk subject import."""
    total_rows: int
    successful: int
    failed: int
    skipped: int
    results: List[SubjectImportResultRow]
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_rows": 10,
                "successful": 9,
                "failed": 1,
                "skipped": 0,
                "results": []
            }
        }


# ==========================================
# CLASS IMPORT SCHEMAS
# ==========================================

class ClassImportRow(BaseModel):
    """Schema for a single class row in import file."""
    class_code: str = Field(..., min_length=1, max_length=50, description="Class code (must be unique)")
    semester_code: str = Field(..., description="Semester code (must exist)")
    subject_code: str = Field(..., description="Subject code (must exist)")
    lecturer_email: EmailStr = Field(..., description="Lecturer email (must be a lecturer user)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "class_code": "IT101-01",
                "semester_code": "2026-SPRING",
                "subject_code": "IT101",
                "lecturer_email": "lecturer1@university.edu"
            }
        }


class ClassImportResultRow(BaseModel):
    """Result for a single imported class."""
    row_number: int
    class_code: str
    status: str  # "success", "error", "skipped"
    class_id: Optional[int] = None
    message: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "row_number": 1,
                "class_code": "IT101-01",
                "status": "success",
                "class_id": 101,
                "message": "Class created successfully"
            }
        }


class ClassImportResponse(BaseModel):
    """Response for bulk class import."""
    total_rows: int
    successful: int
    failed: int
    skipped: int
    results: List[ClassImportResultRow]
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_rows": 5,
                "successful": 5,
                "failed": 0,
                "skipped": 0,
                "results": []
            }
        }


# ==========================================
# USER IMPORT SCHEMAS (Re-export from user_import)
# ==========================================

class UserImportRow(BaseModel):
    """Schema for a single user row in import file."""
    email: EmailStr = Field(..., description="User email (unique)")
    full_name: str = Field(..., max_length=255, description="Full name")
    role_name: str = Field(..., description="Role: ADMIN, STAFF, HEAD_DEPT, LECTURER, STUDENT")
    dept_name: Optional[str] = Field(None, description="Department name (optional for ADMIN/STAFF)")
    phone: Optional[str] = Field(None, max_length=20, description="Phone number")
    
    @field_validator('role_name')
    @classmethod
    def validate_role_name(cls, v):
        """Validate role name is one of allowed values."""
        allowed_roles = ['ADMIN', 'STAFF', 'HEAD_DEPT', 'LECTURER', 'STUDENT']
        if v.upper() not in allowed_roles:
            raise ValueError(f'Role must be one of: {", ".join(allowed_roles)}')
        return v.upper()
    
    @field_validator('dept_name')
    @classmethod
    def validate_dept_for_role(cls, v, info):
        """Department is required for LECTURER and STUDENT roles."""
        role = info.data.get('role_name', '').upper()
        if role in ['LECTURER', 'STUDENT'] and not v:
            raise ValueError(f'Department is required for {role} role')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "student@university.edu",
                "full_name": "Nguyễn Văn A",
                "role_name": "STUDENT",
                "dept_name": "Software Engineering",
                "phone": "0912345678"
            }
        }


class UserImportResultRow(BaseModel):
    """Result for a single imported user."""
    row_number: int
    email: EmailStr
    status: str  # "success", "error", "skipped"
    user_id: Optional[UUID] = None
    message: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "row_number": 1,
                "email": "student@university.edu",
                "status": "success",
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "message": "User created successfully"
            }
        }


class UserImportResponse(BaseModel):
    """Response for bulk user import."""
    total_rows: int
    successful: int
    failed: int
    skipped: int
    results: List[UserImportResultRow]
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_rows": 100,
                "successful": 95,
                "failed": 3,
                "skipped": 2,
                "results": []
            }
        }


# ==========================================
# GENERAL IMPORT STATISTICS/TRACKING
# ==========================================

class ImportStats(BaseModel):
    """Base statistics model for any import operation."""
    total_rows: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
