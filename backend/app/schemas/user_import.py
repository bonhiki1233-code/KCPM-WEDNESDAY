"""
Pydantic schemas for User Import from Excel/CSV.
"""
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, validator


# ==========================================
# REQUEST SCHEMAS
# ==========================================


class UserImportRow(BaseModel):
    """Schema for a single user row in import file."""
    email: EmailStr = Field(..., description="User email (unique)")
    full_name: str = Field(..., max_length=255, description="Full name")
    role_name: str = Field(..., description="Role: ADMIN, STAFF, HEAD_DEPT, LECTURER, STUDENT")
    dept_name: Optional[str] = Field(None, description="Department name (optional for ADMIN/STAFF)")
    phone: Optional[str] = Field(None, max_length=20, description="Phone number")
    
    @validator('role_name')
    def validate_role_name(cls, v):
        """Validate role name is one of allowed values."""
        allowed_roles = ['ADMIN', 'STAFF', 'HEAD_DEPT', 'LECTURER', 'STUDENT']
        if v.upper() not in allowed_roles:
            raise ValueError(f'Role must be one of: {", ".join(allowed_roles)}')
        return v.upper()
    
    @validator('dept_name')
    def validate_dept_for_role(cls, v, values):
        """Department is required for LECTURER and STUDENT roles."""
        role = values.get('role_name', '').upper()
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


# ==========================================
# RESPONSE SCHEMAS
# ==========================================


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
                "results": [
                    {
                        "row_number": 1,
                        "email": "student1@university.edu",
                        "status": "success",
                        "user_id": "550e8400-e29b-41d4-a716-446655440000",
                        "message": "User created successfully"
                    },
                    {
                        "row_number": 2,
                        "email": "duplicate@university.edu",
                        "status": "skipped",
                        "message": "Email already exists"
                    }
                ]
            }
        }


# ==========================================
# INTERNAL SCHEMAS
# ==========================================


class UserImportStats(BaseModel):
    """Internal schema for tracking import statistics."""
    total_rows: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0