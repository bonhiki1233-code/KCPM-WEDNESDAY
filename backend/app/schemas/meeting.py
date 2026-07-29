from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class MeetingCreate(BaseModel):
    team_id: int
    title: str
    start_time: datetime
    end_time: datetime
    meeting_link: Optional[str] = None  # map sang Meeting.link_url

    @field_validator("end_time")
    @classmethod
    def validate_end_time(cls, end_time: datetime, info):
        start_time = info.data.get("start_time")
        if start_time and end_time <= start_time:
            raise ValueError("end_time must be greater than start_time")
        return end_time


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    meeting_link: Optional[str] = None  # map sang link_url

    @field_validator("end_time")
    @classmethod
    def validate_end_time_update(cls, end_time: Optional[datetime], info):
        start_time = info.data.get("start_time")
        if start_time and end_time and end_time <= start_time:
            raise ValueError("end_time must be greater than start_time")
        return end_time


class MeetingResponse(BaseModel):
    meeting_id: int
    team_id: int
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    meeting_link: Optional[str] = None  # expose từ link_url
    created_by: UUID                   # expose từ organizer_id
    created_at: datetime
