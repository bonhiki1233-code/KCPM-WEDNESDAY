"""
Evaluation Detail Schemas for BE4 Phase 4
Handles scoring by criteria with weighted calculation
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


class EvaluationDetailCreate(BaseModel):
    """Create a new criteria score for an evaluation"""
    criteria_id: int
    score: float = Field(..., ge=0, le=10, description="Score from 0 to 10")
    comment: Optional[str] = None

    @field_validator('score')
    @classmethod
    def validate_score(cls, v):
        if v < 0 or v > 10:
            raise ValueError('Score must be between 0 and 10')
        return round(v, 2)


class EvaluationDetailUpdate(BaseModel):
    """Update an existing criteria score"""
    score: Optional[float] = Field(None, ge=0, le=10)
    comment: Optional[str] = None

    @field_validator('score')
    @classmethod
    def validate_score(cls, v):
        if v is not None and (v < 0 or v > 10):
            raise ValueError('Score must be between 0 and 10')
        return round(v, 2) if v is not None else v


class EvaluationDetailResponse(BaseModel):
    """Response schema for evaluation detail"""
    detail_id: int
    evaluation_id: int
    criteria_id: int
    criteria_name: Optional[str] = None
    criteria_weight: Optional[float] = None
    score: Optional[float] = None
    weighted_score: Optional[float] = None  # score * weight
    comment: Optional[str] = None

    model_config = {"from_attributes": True}


class CriteriaSummary(BaseModel):
    """Summary of a single criteria score"""
    criteria_id: int
    criteria_name: str
    weight: float
    score: float
    weighted_score: float


class EvaluationSummary(BaseModel):
    """Aggregated evaluation summary with weighted scores"""
    evaluation_id: int
    team_id: Optional[int] = None
    topic_id: Optional[int] = None
    evaluator_name: Optional[str] = None
    
    # Criteria breakdown
    criteria_scores: List[CriteriaSummary] = []
    
    # Aggregated scores
    total_weight: float = 0.0
    weighted_total: float = 0.0
    final_score: float = 0.0  # weighted_total / total_weight * 10
    
    # Metadata
    feedback: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================
# PEER REVIEW SCORING (BR-01)
# ============================================

class PeerReviewScore(BaseModel):
    """Peer review score for individual calculation"""
    reviewer_id: str
    reviewee_id: str
    rating: int = Field(..., ge=1, le=10, description="Rating from 1 to 10")
    comment: Optional[str] = None


class IndividualScoreCalculation(BaseModel):
    """
    BR-01: Individual Score Calculation
    Formula: Individual Score = Group Score * (Average Peer Rating / 10)
    Condition: Score capped at 10 if exceeds
    """
    student_id: str
    student_name: Optional[str] = None
    group_score: float
    average_peer_rating: float
    individual_score: float  # Calculated and capped at 10
    peer_reviews_count: int = 0

    @classmethod
    def calculate(cls, student_id: str, group_score: float, avg_peer_rating: float, 
                  student_name: str = None, reviews_count: int = 0):
        """Calculate individual score using BR-01 formula"""
        raw_score = group_score * (avg_peer_rating / 10)
        final_score = min(raw_score, 10.0)  # Cap at 10
        
        return cls(
            student_id=student_id,
            student_name=student_name,
            group_score=group_score,
            average_peer_rating=avg_peer_rating,
            individual_score=round(final_score, 2),
            peer_reviews_count=reviews_count
        )


class TeamGradingSummary(BaseModel):
    """Complete grading summary for a team"""
    team_id: int
    team_name: Optional[str] = None
    group_score: float
    individual_scores: List[IndividualScoreCalculation] = []
    graded_by: Optional[str] = None
    graded_at: Optional[datetime] = None
