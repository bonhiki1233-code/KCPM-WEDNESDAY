"""Pydantic schemas for import logs."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class ImportLogBase(BaseModel):
    """Base schema for import log."""
    import_type: str  # 'subjects', 'classes', 'users'
    total_rows: int
    successful: int
    failed: int
    skipped: int
    details: Optional[str] = None  # JSON string
    imported_ids: Optional[str] = None  # JSON array string


class ImportLogCreate(ImportLogBase):
    """Schema for creating import log."""
    pass


class ImportLogResponse(ImportLogBase):
    """Schema for import log response."""
    log_id: int
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
