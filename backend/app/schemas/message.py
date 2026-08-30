"""
Message schemas for API requests and responses
Phase 3 - Real-time Features
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID


class MessageCreate(BaseModel):
    """Schema for sending a new message"""
    channel_id: int
    content: str = Field(..., min_length=1, max_length=5000)


class MessageUpdate(BaseModel):
    """Schema for editing a message"""
    content: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    """Schema for message response"""
    message_id: int
    channel_id: int
    sender_id: UUID
    sender_name: Optional[str] = None
    content: Optional[str]
    sent_at: datetime
    is_edited: bool = False
    
    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    """Schema for paginated message list"""
    messages: List[MessageResponse]
    total: int
    has_more: bool
    skip: int
    limit: int
