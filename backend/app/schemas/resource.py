"""
Resource Schemas for BE4 Phase 4
Handles learning materials and project resources
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ResourceCreate(BaseModel):
    """Create a new resource"""
    team_id: Optional[int] = None
    class_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    resource_type: str = Field(..., description="link, file, document")
    url: str = Field(..., min_length=1)
    tags: List[str] = []

    @field_validator('resource_type')
    @classmethod
    def validate_type(cls, v):
        allowed = ['link', 'file', 'document', 'video', 'image', 'pdf', 'spreadsheet', 'presentation', 'code', 'other']
        if v.lower() not in allowed:
            raise ValueError(f'resource_type must be one of: {allowed}')
        return v.lower()

    @field_validator('tags', mode='before')
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            return [t.strip() for t in v.split(',') if t.strip()]
        return v or []


class ResourceUpdate(BaseModel):
    """Update an existing resource"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    resource_type: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator('resource_type')
    @classmethod
    def validate_type(cls, v):
        if v is None:
            return v
        allowed = ['link', 'file', 'document', 'video', 'image', 'pdf', 'spreadsheet', 'presentation', 'code', 'other']
        if v.lower() not in allowed:
            raise ValueError(f'resource_type must be one of: {allowed}')
        return v.lower()


class ResourceResponse(BaseModel):
    """Response schema for resource"""
    resource_id: int
    team_id: Optional[int] = None
    class_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    resource_type: Optional[str] = None
    url: Optional[str] = None
    file_url: Optional[str] = None  # Legacy field
    file_type: Optional[str] = None  # Legacy field
    tags: List[str] = []
    
    # Uploader info
    uploaded_by: Optional[UUID] = None
    uploader_name: Optional[str] = None
    
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ResourceListResponse(BaseModel):
    """Paginated list of resources"""
    resources: List[ResourceResponse]
    total: int
    page: int = 1
    per_page: int = 20


class ResourceFilter(BaseModel):
    """Filter options for resource listing"""
    team_id: Optional[int] = None
    class_id: Optional[int] = None
    resource_type: Optional[str] = None
    tag: Optional[str] = None
    search: Optional[str] = None
