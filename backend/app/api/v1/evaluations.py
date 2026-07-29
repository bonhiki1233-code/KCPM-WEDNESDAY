"""
BE4 - Evaluation Details Endpoints
Phase 4: Evaluation System with Criteria Scoring

Endpoints:
- POST /evaluations/{id}/details - Add criteria score
- GET /evaluations/{id}/details - List all criteria scores
- PUT /evaluations/{id}/details/{criteria_id} - Update score
- GET /evaluations/{id}/summary - Aggregated weighted scores
- GET /evaluations/{id}/individual-scores - Individual scores with peer review (BR-01)
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timezone

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.all_models import (
    User, Evaluation, EvaluationDetail, EvaluationCriterion,
    PeerReview, Team, TeamMember
)
from app.schemas.evaluation_detail import (
    EvaluationDetailCreate, EvaluationDetailUpdate, EvaluationDetailResponse,
    EvaluationSummary, CriteriaSummary, IndividualScoreCalculation, TeamGradingSummary
)

router = APIRouter()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def check_evaluator_permission(user: User):
    """Only Lecturers (4), Head Dept (3), Admin (1), Staff (2) can evaluate"""
    if user.role_id not in [1, 2, 3, 4]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers, staff, or admins can manage evaluations"
        )


async def get_evaluation_or_404(db: AsyncSession, evaluation_id: int) -> Evaluation:
    """Get evaluation by ID or raise 404"""
    result = await db.execute(
        select(Evaluation).where(Evaluation.evaluation_id == evaluation_id)
    )
    evaluation = result.scalars().first()
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation {evaluation_id} not found"
        )
    return evaluation


# ============================================================================
# EVALUATION DETAIL ENDPOINTS
# ============================================================================

@router.post("/{evaluation_id}/details", response_model=EvaluationDetailResponse, status_code=201)
async def add_criteria_score(
    evaluation_id: int,
    detail_in: EvaluationDetailCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a criteria score to an evaluation.
    Only lecturers/admins can add scores.
    
    Request:
        {
            "criteria_id": 1,
            "score": 8.5,
            "comment": "Good implementation"
        }
    """
    check_evaluator_permission(current_user)
    
    # Verify evaluation exists
    evaluation = await get_evaluation_or_404(db, evaluation_id)
    
    # Verify criteria exists
    criteria_result = await db.execute(
        select(EvaluationCriterion).where(
            EvaluationCriterion.criteria_id == detail_in.criteria_id
        )
    )
    criterion = criteria_result.scalars().first()
    if not criterion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Criteria {detail_in.criteria_id} not found"
        )
    
    # Check if detail already exists for this criteria
    existing = await db.execute(
        select(EvaluationDetail).where(
            EvaluationDetail.evaluation_id == evaluation_id,
            EvaluationDetail.criteria_id == detail_in.criteria_id
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Score for criteria {detail_in.criteria_id} already exists. Use PUT to update."
        )
    
    # Create new detail
    new_detail = EvaluationDetail(
        evaluation_id=evaluation_id,
        criteria_id=detail_in.criteria_id,
        score=detail_in.score,
        comment=detail_in.comment
    )
    
    db.add(new_detail)
    await db.commit()
    await db.refresh(new_detail)
    
    # Calculate weighted score
    weighted_score = (detail_in.score * criterion.weight) if criterion.weight else detail_in.score
    
    return EvaluationDetailResponse(
        detail_id=new_detail.detail_id,
        evaluation_id=new_detail.evaluation_id,
        criteria_id=new_detail.criteria_id,
        criteria_name=criterion.criteria_name,
        criteria_weight=criterion.weight,
        score=new_detail.score,
        weighted_score=round(weighted_score, 2),
        comment=new_detail.comment
    )


@router.get("/{evaluation_id}/details", response_model=List[EvaluationDetailResponse])
async def list_criteria_scores(
    evaluation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all criteria scores for an evaluation.
    Returns scores with criteria names and weighted values.
    """
    # Verify evaluation exists
    await get_evaluation_or_404(db, evaluation_id)
    
    # Get all details with criteria info
    result = await db.execute(
        select(EvaluationDetail, EvaluationCriterion)
        .join(EvaluationCriterion, EvaluationDetail.criteria_id == EvaluationCriterion.criteria_id)
        .where(EvaluationDetail.evaluation_id == evaluation_id)
    )
    
    details = result.all()
    
    response = []
    for detail, criterion in details:
        weighted_score = (detail.score * criterion.weight) if criterion.weight and detail.score else 0
        response.append(EvaluationDetailResponse(
            detail_id=detail.detail_id,
            evaluation_id=detail.evaluation_id,
            criteria_id=detail.criteria_id,
            criteria_name=criterion.criteria_name,
            criteria_weight=criterion.weight,
            score=detail.score,
            weighted_score=round(weighted_score, 2),
            comment=detail.comment
        ))
    
    return response


@router.put("/{evaluation_id}/details/{criteria_id}", response_model=EvaluationDetailResponse)
async def update_criteria_score(
    evaluation_id: int,
    criteria_id: int,
    detail_in: EvaluationDetailUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a specific criteria score.
    Only the original evaluator or admin can update.
    """
    check_evaluator_permission(current_user)
    
    # Find existing detail
    result = await db.execute(
        select(EvaluationDetail, EvaluationCriterion)
        .join(EvaluationCriterion, EvaluationDetail.criteria_id == EvaluationCriterion.criteria_id)
        .where(
            EvaluationDetail.evaluation_id == evaluation_id,
            EvaluationDetail.criteria_id == criteria_id
        )
    )
    row = result.first()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No score found for criteria {criteria_id} in evaluation {evaluation_id}"
        )
    
    detail, criterion = row
    
    # Update fields
    if detail_in.score is not None:
        detail.score = detail_in.score
    if detail_in.comment is not None:
        detail.comment = detail_in.comment
    
    db.add(detail)
    await db.commit()
    await db.refresh(detail)
    
    weighted_score = (detail.score * criterion.weight) if criterion.weight and detail.score else 0
    
    return EvaluationDetailResponse(
        detail_id=detail.detail_id,
        evaluation_id=detail.evaluation_id,
        criteria_id=detail.criteria_id,
        criteria_name=criterion.criteria_name,
        criteria_weight=criterion.weight,
        score=detail.score,
        weighted_score=round(weighted_score, 2),
        comment=detail.comment
    )


@router.get("/{evaluation_id}/summary", response_model=EvaluationSummary)
async def get_evaluation_summary(
    evaluation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated evaluation summary with weighted scores.
    Calculates final score based on criteria weights.
    
    Formula: final_score = sum(score * weight) / sum(weight) * 10
    """
    # Get evaluation with evaluator info
    eval_result = await db.execute(
        select(Evaluation, User)
        .join(User, Evaluation.evaluator_id == User.user_id)
        .where(Evaluation.evaluation_id == evaluation_id)
    )
    eval_row = eval_result.first()
    
    if not eval_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation {evaluation_id} not found"
        )
    
    evaluation, evaluator = eval_row
    
    # Get all details with criteria
    details_result = await db.execute(
        select(EvaluationDetail, EvaluationCriterion)
        .join(EvaluationCriterion, EvaluationDetail.criteria_id == EvaluationCriterion.criteria_id)
        .where(EvaluationDetail.evaluation_id == evaluation_id)
    )
    
    criteria_scores = []
    total_weight = 0.0
    weighted_total = 0.0
    
    for detail, criterion in details_result.all():
        weight = criterion.weight or 1.0
        score = detail.score or 0.0
        weighted_score = score * weight
        
        criteria_scores.append(CriteriaSummary(
            criteria_id=criterion.criteria_id,
            criteria_name=criterion.criteria_name or f"Criteria {criterion.criteria_id}",
            weight=weight,
            score=score,
            weighted_score=round(weighted_score, 2)
        ))
        
        total_weight += weight
        weighted_total += weighted_score
    
    # Calculate final score (normalize to 10-point scale)
    final_score = (weighted_total / total_weight * 10) if total_weight > 0 else 0
    final_score = min(final_score, 10.0)  # Cap at 10
    
    return EvaluationSummary(
        evaluation_id=evaluation_id,
        team_id=evaluation.team_id,
        topic_id=evaluation.topic_id,
        evaluator_name=evaluator.full_name,
        criteria_scores=criteria_scores,
        total_weight=round(total_weight, 2),
        weighted_total=round(weighted_total, 2),
        final_score=round(final_score, 2),
        feedback=evaluation.feedback,
        created_at=evaluation.created_at,
        updated_at=evaluation.updated_at
    )


# ============================================================================
# INDIVIDUAL SCORING WITH PEER REVIEW (BR-01)
# ============================================================================

@router.get("/{evaluation_id}/individual-scores", response_model=TeamGradingSummary)
async def get_individual_scores(
    evaluation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate individual scores using BR-01 Peer Review Formula.
    
    Formula: Individual Score = Group Score * (Average Peer Rating / 10)
    Condition: Score capped at 10 if exceeds.
    
    Example: Group gets 9, Student A gets avg peer rating 8/10
            -> Score = 9 * 0.8 = 7.2
    """
    # Get evaluation
    evaluation = await get_evaluation_or_404(db, evaluation_id)
    
    if not evaluation.team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This evaluation is not associated with a team"
        )
    
    # Get group score from evaluation
    group_score = evaluation.score or evaluation.total_score or 0.0
    
    # Get team info
    team_result = await db.execute(
        select(Team).where(Team.team_id == evaluation.team_id)
    )
    team = team_result.scalars().first()
    
    # Get all team members
    members_result = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.user_id)
        .where(TeamMember.team_id == evaluation.team_id)
    )
    
    individual_scores = []
    
    for member, user in members_result.all():
        # Get average peer rating for this student
        peer_rating_result = await db.execute(
            select(func.avg(PeerReview.score), func.count(PeerReview.review_id))
            .where(
                PeerReview.reviewee_id == user.user_id,
                PeerReview.team_id == evaluation.team_id
            )
        )
        row = peer_rating_result.first()
        avg_rating = float(row[0]) if row[0] else 10.0  # Default to 10 if no reviews
        review_count = row[1] or 0
        
        # Calculate individual score using BR-01 formula
        individual_score = IndividualScoreCalculation.calculate(
            student_id=str(user.user_id),
            student_name=user.full_name,
            group_score=group_score,
            avg_peer_rating=avg_rating,
            reviews_count=review_count
        )
        
        individual_scores.append(individual_score)
    
    # Get evaluator name
    evaluator_result = await db.execute(
        select(User).where(User.user_id == evaluation.evaluator_id)
    )
    evaluator = evaluator_result.scalars().first()
    
    return TeamGradingSummary(
        team_id=evaluation.team_id,
        team_name=team.team_name if team else None,
        group_score=group_score,
        individual_scores=individual_scores,
        graded_by=evaluator.full_name if evaluator else None,
        graded_at=evaluation.created_at
    )
