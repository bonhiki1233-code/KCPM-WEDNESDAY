"""
Pydantic schemas for User Profile Management.
Handles GET /me and PUT /me endpoints.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, validator
import re


# ==========================================
# BASE SCHEMAS
# ==========================================


class UserProfileBase(BaseModel):
    """Base schema for user profile data."""
    full_name: Optional[str] = Field(None, max_length=255, description="User's full name")
    avatar_url: Optional[str] = Field(None, max_length=10000000, description="URL to user avatar (HTTP or Base64)")
    phone: Optional[str] = Field(None, max_length=20, description="Phone number")
    bio: Optional[str] = Field(None, max_length=1000, description="User biography")


# ==========================================
# REQUEST SCHEMAS
# ==========================================


class UserProfileUpdate(UserProfileBase):
    """Schema for updating user profile (PUT /me)."""
    
    @validator('phone')
    def validate_phone(cls, v):
        """Validate phone number format (Vietnamese phone numbers)."""
        if v is None:
            return v
        
        # Remove all spaces, dashes, parentheses
        phone_cleaned = re.sub(r'[\s\-\(\)]', '', v)
        
        # Vietnamese phone format: 
        # - Must start with 0 or +84
        # - Mobile: 10 digits (0x + 8 digits) or +84 + 9 digits
        # - Landline: 10-11 digits
        vietnamese_mobile = r'^(0[3|5|7|8|9])\d{8}$'
        international_mobile = r'^\+84[3|5|7|8|9]\d{8}$'
        vietnamese_landline = r'^(0[2-9])\d{8,9}$'
        
        if not (re.match(vietnamese_mobile, phone_cleaned) or 
                re.match(international_mobile, phone_cleaned) or
                re.match(vietnamese_landline, phone_cleaned)):
            raise ValueError(
                'Phone number must be a valid Vietnamese phone number. '
                'Examples: 0912345678, +84912345678, 0281234567'
            )
        
        return phone_cleaned
    
    @validator('avatar_url')
    def validate_avatar_url(cls, v):
        """Validate avatar URL format - accepts HTTP URLs and base64 data URLs."""
        if v is None:
            return v
        
        # Allow base64 data URLs (for uploaded images)
        if v.startswith('data:image/'):
            return v
        
        # Basic HTTP/HTTPS URL validation for external images
        url_pattern = r'^https?://.*\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$'
        if not re.match(url_pattern, v, re.IGNORECASE):
            raise ValueError(
                'Avatar URL must be a valid image URL (jpg, jpeg, png, gif, webp, svg) or base64 data URL'
            )
        
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Nguyễn Văn A",
                "avatar_url": "https://example.com/avatar.jpg",
                "phone": "0912345678",
                "bio": "Software Engineering student passionate about AI and Web Development"
            }
        }


# ==========================================
# RESPONSE SCHEMAS
# ==========================================


class DepartmentInfo(BaseModel):
    """Department information for user profile response."""
    dept_id: int
    dept_name: str
    
    class Config:
        from_attributes = True


class RoleInfo(BaseModel):
    """Role information for user profile response."""
    role_id: int
    role_name: str
    
    class Config:
        from_attributes = True


class UserProfileResponse(UserProfileBase):
    """Schema for user profile response (GET /me, PUT /me)."""
    user_id: UUID
    email: EmailStr
    role: RoleInfo
    department: Optional[DepartmentInfo] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "email": "student@university.edu",
                "full_name": "Nguyễn Văn A",
                "avatar_url": "https://example.com/avatar.jpg",
                "phone": "0912345678",
                "bio": "Software Engineering student",
                "role": {
                    "role_id": 5,
                    "role_name": "STUDENT"
                },
                "department": {
                    "dept_id": 1,
                    "dept_name": "Software Engineering"
                },
                "is_active": True,
                "created_at": "2024-01-15T10:30:00Z"
            }
        }