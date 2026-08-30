"""
Pydantic schemas for Notification Management.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ==========================================
# BASE SCHEMAS
# ==========================================


class NotificationBase(BaseModel):
    """Base schema for notification data."""
    type: str = Field(..., description="Notification type: SYSTEM, MILESTONE, SUBMISSION, TEAM, MENTION, TASK")
    title: str = Field(..., max_length=255, description="Notification title")
    message: Optional[str] = Field(None, description="Notification message/details")
    related_entity_type: Optional[str] = Field(None, max_length=50, description="Related entity type (team, project, milestone)")
    related_entity_id: Optional[int] = Field(None, description="Related entity ID")
    action_url: Optional[str] = Field(None, max_length=500, description="URL for action button")


# ==========================================
# REQUEST SCHEMAS
# ==========================================


class NotificationCreate(NotificationBase):
    """Schema for creating a notification."""
    user_id: UUID = Field(..., description="User ID to send notification to")
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "type": "MILESTONE",
                "title": "Milestone Deadline Approaching",
                "message": "Milestone 'Sprint 1 Review' is due in 2 days",
                "related_entity_type": "milestone",
                "related_entity_id": 123,
                "action_url": "/milestones/123"
            }
        }


class NotificationMarkRead(BaseModel):
    """Schema for marking notification(s) as read."""
    notification_ids: list[int] = Field(..., description="List of notification IDs to mark as read")
    
    class Config:
        json_schema_extra = {
            "example": {
                "notification_ids": [1, 2, 3, 5, 8]
            }
        }


# ==========================================
# RESPONSE SCHEMAS
# ==========================================


class NotificationResponse(NotificationBase):
    """Schema for notification response."""
    notification_id: int
    user_id: UUID
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "notification_id": 123,
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "type": "MILESTONE",
                "title": "Milestone Deadline Approaching",
                "message": "Milestone 'Sprint 1 Review' is due in 2 days",
                "related_entity_type": "milestone",
                "related_entity_id": 123,
                "action_url": "/milestones/123",
                "is_read": False,
                "read_at": None,
                "created_at": "2025-01-07T10:30:00Z"
            }
        }


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list."""
    total: int = Field(..., description="Total number of notifications")
    unread_count: int = Field(..., description="Number of unread notifications")
    notifications: list[NotificationResponse]
    
    class Config:
        json_schema_extra = {
            "example": {
                "total": 25,
                "unread_count": 5,
                "notifications": [
                    {
                        "notification_id": 123,
                        "user_id": "550e8400-e29b-41d4-a716-446655440000",
                        "type": "MILESTONE",
                        "title": "Milestone Deadline Approaching",
                        "message": "Milestone 'Sprint 1 Review' is due in 2 days",
                        "related_entity_type": "milestone",
                        "related_entity_id": 123,
                        "action_url": "/milestones/123",
                        "is_read": False,
                        "read_at": None,
                        "created_at": "2025-01-07T10:30:00Z"
                    }
                ]
            }
        }


class NotificationStats(BaseModel):
    """Schema for notification statistics."""
    total: int
    unread: int
    by_type: dict[str, int] = Field(..., description="Count of notifications by type")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total": 50,
                "unread": 12,
                "by_type": {
                    "MILESTONE": 15,
                    "SUBMISSION": 10,
                    "TEAM": 8,
                    "TASK": 12,
                    "SYSTEM": 5
                }
            }
        }