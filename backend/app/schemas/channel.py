"""
Channel schemas for API requests and responses
Phase 3 - Real-time Features
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ChannelCreate(BaseModel):
    """Schema for creating a new channel"""
    team_id: int
    name: str = Field(..., min_length=1, max_length=100)
    type: Optional[str] = "general"


class ChannelUpdate(BaseModel):
    """Schema for updating channel details"""
    name: Optional[str] = None
    type: Optional[str] = None


class ChannelResponse(BaseModel):
    """Schema for channel response"""
    channel_id: int
    team_id: int
    name: Optional[str]
    type: Optional[str]
    created_at: datetime
    message_count: int = 0
    
    class Config:
        from_attributes = True
