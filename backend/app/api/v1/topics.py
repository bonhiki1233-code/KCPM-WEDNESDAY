"""
BE2 - Topics & Evaluation Endpoints
Author: Backend Dev 2
Created: 2026-01-28

Description:
- Lecturers create topics (DRAFT)
- HEAD_DEPT approves topics → APPROVED
- Students view only APPROVED topics
- Lecturers evaluate teams
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from typing import Optional

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.all_models import User, Topic, EvaluationCriterion, Evaluation
from app.schemas.topic import (
    TopicCreate, TopicUpdate, EvaluationCreate
)

router = APIRouter()

# ============================================================================
# TOPICS ENDPOINTS
# ============================================================================

@router.post("", status_code=201)
async def create_topic(
    topic: TopicCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new topic (Lecturer only)
    - Status: DRAFT by default
    - Only role_id 4 (Lecturer) can create
    
    Request:
        {
            "title": "AI Chatbot Project",
            "description": "Build an AI-powered chatbot",
            "requirements": "Python, NLP knowledge"
        }
    
    Response:
        {
            "topic_id": 1,
            "title": "AI Chatbot Project",
            "status": "DRAFT",
            "created_by": "lecturer@example.com",
            "created_at": "2026-01-28T10:00:00"
        }
    """
    
    # Role check: only lecturers (role_id=4) can create
    if current_user.role_id != 4:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can create topics"
        )
    if not current_user.can_create_topics:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to create topics"
        )
    
    # Create new topic
    new_topic = Topic(
        title=topic.title,
        description=topic.description,
        objectives=topic.requirements,
        status="DRAFT",
        creator_id=current_user.user_id,
        dept_id=current_user.dept_id,
        created_at=datetime.now(timezone.utc),
    )
    
    db.add(new_topic)
    await db.commit()
    await db.refresh(new_topic)
    
    return {
        "topic_id": new_topic.topic_id,
        "title": new_topic.title,
        "description": new_topic.description,
        "status": new_topic.status,
        "created_by": current_user.full_name,
        "created_at": new_topic.created_at
    }


@router.get("")
async def get_topics(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get topics list
    - Lecturers see all topics
    - Students see only APPROVED topics
    
    Query params:
        ?status=DRAFT  (filters by status)
    
    Response:
        {
            "topics": [
                {
                    "topic_id": 1,
                    "title": "AI Project",
                    "status": "APPROVED",
                    "created_by": "lecturer@example.com"
                },
                ...
            ],
            "total": 5
        }
    """
    
    query = select(Topic)
    
    # Filter: students see only APPROVED
    if current_user.role_id == 5:  # Student
        query = query.where(Topic.status == "APPROVED")
    
    # Optional status filter
    if status_filter:
        query = query.where(Topic.status == status_filter)
    
    # Execute query
    result = await db.execute(query)
    topics = result.scalars().all()
    
    topics_response = []
    for t in topics:
        # Get creator name
        creator_query = select(User).where(User.user_id == t.creator_id)
        creator_result = await db.execute(creator_query)
        creator = creator_result.scalar()
        
        topics_response.append({
            "topic_id": t.topic_id,
            "title": t.title,
            "description": t.description,
            "requirements": t.objectives,
            "status": t.status,
            "created_by": creator.full_name if creator else "Unknown",
            "created_at": t.created_at
        })
    
    return {
        "topics": topics_response,
        "total": len(topics_response)
    }


@router.get("/{topic_id}")
async def get_topic_detail(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get topic details by ID
    
    Response:
        {
            "topic_id": 1,
            "title": "AI Project",
            "description": "...",
            "status": "APPROVED",
            "created_by": "lecturer@example.com",
            "created_at": "2026-01-28T10:00:00",
            "approved_by": "admin@example.com",
            "approved_at": "2026-01-28T11:00:00"
        }
    """
    
    query = select(Topic).where(Topic.topic_id == topic_id)
    result = await db.execute(query)
    topic = result.scalar()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    # Students can only see APPROVED topics
    if current_user.role_id == 5 and topic.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view approved topics"
        )
    
    # Get creator info
    creator_query = select(User).where(User.user_id == topic.creator_id)
    creator_result = await db.execute(creator_query)
    creator = creator_result.scalar()
    
    return {
        "topic_id": topic.topic_id,
        "title": topic.title,
        "description": topic.description,
        "requirements": topic.objectives,
        "status": topic.status,
        "created_by": creator.full_name if creator else "Unknown",
        "created_at": topic.created_at,
        "approved_by": None,
        "approved_at": None
    }


@router.patch("/{topic_id}/approve")
async def approve_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Approve a topic (HEAD_DEPT or ADMIN only)
    - Changes status from DRAFT to APPROVED
    - Sets approved_by and approved_at
    
    Response:
        {
            "topic_id": 1,
            "status": "APPROVED",
            "approved_by": "admin@example.com",
            "approved_at": "2026-01-28T11:00:00"
        }
    """
    
    # Role check: only HEAD_DEPT (3) and ADMIN (1) can approve
    if current_user.role_id not in [1, 3]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or heads of department can approve topics"
        )
    
    # Get topic
    query = select(Topic).where(Topic.topic_id == topic_id)
    result = await db.execute(query)
    topic = result.scalar()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    # Update status
    topic.status = "APPROVED"
    
    db.add(topic)
    await db.commit()
    
    return {
        "topic_id": topic.topic_id,
        "status": topic.status,
        "approved_by": current_user.full_name,
        "approved_at": datetime.now(timezone.utc)
    }


@router.patch("/{topic_id}/reject")
async def reject_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reject a topic (HEAD_DEPT or ADMIN only)
    - Changes status from DRAFT to REJECTED
    - Sets approved_by and approved_at
    
    Response:
        {
            "topic_id": 1,
            "status": "REJECTED",
            "rejected_by": "admin@example.com",
            "rejected_at": "2026-01-28T11:00:00"
        }
    """
    
    # Role check
    if current_user.role_id not in [1, 3]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or heads of department can reject topics"
        )
    
    # Get topic
    query = select(Topic).where(Topic.topic_id == topic_id)
    result = await db.execute(query)
    topic = result.scalar()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    # Update status
    topic.status = "REJECTED"
    
    db.add(topic)
    await db.commit()
    
    return {
        "topic_id": topic.topic_id,
        "status": topic.status,
        "rejected_by": current_user.full_name,
        "rejected_at": datetime.now(timezone.utc)
    }


@router.delete("/{topic_id}", status_code=200)
async def delete_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a topic
    - Lecturers can delete their own topics
    - Admin/Head Dept can delete any topic
    """

    # Get topic
    query = select(Topic).where(Topic.topic_id == topic_id)
    result = await db.execute(query)
    topic = result.scalar()

    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )

    # Permission checks
    if current_user.role_id == 4:
        if topic.creator_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own topics"
            )
    elif current_user.role_id not in [1, 3]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete topics"
        )

    await db.delete(topic)
    await db.commit()

    return {
        "topic_id": topic_id,
        "message": "Topic deleted"
    }


# ============================================================================
# EVALUATION ENDPOINTS
# ============================================================================

@router.post("/evaluations/{topic_id}")
async def create_evaluation(
    topic_id: int,
    eval_data: EvaluationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create evaluation for a team on a topic (Lecturer only)
    
    Request:
        {
            "team_id": 1,
            "project_id": 5,
            "score": 8.5,
            "feedback": "Great work on the project"
        }
    
    Response:
        {
            "evaluation_id": 1,
            "team_id": 1,
            "topic_id": 1,
            "score": 8.5,
            "feedback": "Great work...",
            "evaluator": "lecturer@example.com",
            "created_at": "2026-01-28T11:00:00"
        }
    """
    
    # Role check: only lecturers can evaluate
    if current_user.role_id != 4:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can create evaluations"
        )
    
    # Verify topic exists
    topic_query = select(Topic).where(Topic.topic_id == topic_id)
    topic_result = await db.execute(topic_query)
    topic = topic_result.scalar()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    # Create evaluation
    evaluation = Evaluation(
        team_id=eval_data.team_id,
        topic_id=topic_id,
        evaluator_id=current_user.user_id,
        score=eval_data.score,
        feedback=eval_data.feedback,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    
    db.add(evaluation)
    await db.commit()
    await db.refresh(evaluation)
    
    return {
        "evaluation_id": evaluation.evaluation_id,
        "team_id": evaluation.team_id,
        "topic_id": evaluation.topic_id,
        "score": evaluation.score,
        "feedback": evaluation.feedback,
        "evaluator": current_user.full_name,
        "created_at": evaluation.created_at
    }


@router.get("/evaluations")
async def get_evaluations(
    team_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get evaluations (filter by team_id if provided)
    
    Response:
        {
            "evaluations": [
                {
                    "evaluation_id": 1,
                    "team_id": 1,
                    "topic_id": 1,
                    "score": 8.5,
                    "feedback": "..."
                },
                ...
            ],
            "total": 3
        }
    """
    
    query = select(Evaluation)
    
    if team_id:
        query = query.where(Evaluation.team_id == team_id)
    
    result = await db.execute(query)
    evaluations = result.scalars().all()
    
    evaluations_response = []
    for e in evaluations:
        # Get evaluator name
        evaluator_query = select(User).where(User.user_id == e.evaluator_id)
        evaluator_result = await db.execute(evaluator_query)
        evaluator = evaluator_result.scalar()
        
        evaluations_response.append({
            "evaluation_id": e.evaluation_id,
            "team_id": e.team_id,
            "topic_id": e.topic_id,
            "score": e.score,
            "feedback": e.feedback,
            "evaluator": evaluator.full_name if evaluator else "Unknown",
            "created_at": e.created_at
        })
    
    return {
        "evaluations": evaluations_response,
        "total": len(evaluations_response)
    }
