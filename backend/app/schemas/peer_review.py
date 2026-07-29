# app/schemas/peer_review.py

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from uuid import UUID

# ==========================================
# PEER REVIEW SCHEMAS
# ==========================================

class PeerReviewCreate(BaseModel):
    """Schema để tạo peer review"""
    team_id: int = Field(..., description="ID của team")
    reviewee_id: UUID = Field(..., description="ID của người được review")
    sprint_id: Optional[int] = Field(None, description="ID của sprint (nếu có)")
    criteria_name: str = Field(..., description="Tiêu chí đánh giá: collaboration, communication, contribution")
    score: int = Field(..., ge=1, le=5, description="Điểm từ 1-5")
    comment: Optional[str] = Field(None, max_length=1000, description="Nhận xét (tùy chọn)")

    @validator('score')
    def validate_score(cls, v):
        if not 1 <= v <= 5:
            raise ValueError('Score must be between 1 and 5')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "team_id": 1,
                "reviewee_id": "123e4567-e89b-12d3-a456-426614174000",
                "sprint_id": 1,
                "criteria_name": "collaboration",
                "score": 5,
                "comment": "Great teamwork!"
            }
        }


class PeerReviewUpdate(BaseModel):
    """Schema để cập nhật peer review"""
    score: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


class PeerReviewResponse(BaseModel):
    """Schema response cho peer review (KHÔNG có reviewer_id để đảm bảo anonymous)"""
    review_id: int
    team_id: int
    # NOTE: KHÔNG bao gồm reviewer_id để đảm bảo anonymous!
    reviewee_id: UUID
    reviewee_name: Optional[str] = None
    sprint_id: Optional[int] = None
    criteria_name: Optional[str]
    score: Optional[int]
    comment: Optional[str]
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PeerReviewAnonymousResponse(BaseModel):
    """Response ẩn danh cho reviewee xem chính mình"""
    review_id: int
    score: int
    comment: Optional[str]
    created_at: datetime


class PeerReviewSummary(BaseModel):
    """Schema tổng hợp peer reviews cho một người"""
    reviewee_id: UUID
    reviewee_name: str
    average_score: float
    total_reviews: int
    feedback_summary: List[str]  # Top comments
