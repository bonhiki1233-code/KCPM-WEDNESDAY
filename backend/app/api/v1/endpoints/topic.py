from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from typing import Optional

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.all_models import (
    User,
    Topic,
    Evaluation,
    AcademicClass,
    Project,
    Department,
    Semester,
    Subject,
)
from app.schemas.topic import (
    TopicCreate, TopicUpdate, TopicResponse, EvaluationCreate, EvaluationResponse
)
from app.dao.topic_dao import TopicDAO

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
    """
    if current_user.role_id != 4:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can create topics"
        )
    if not getattr(current_user, "can_create_topics", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Topic creation permission required"
        )
    
    dao = TopicDAO(db)
    new_topic = await dao.create_topic(topic, current_user.user_id, current_user.dept_id)
    
    return {
        "topic_id": new_topic.topic_id,
        "title": new_topic.title,
        "description": new_topic.description,
        "requirements": new_topic.requirements,
        "objectives": new_topic.objectives,
        "tech_stack": new_topic.tech_stack,
        "status": new_topic.status,
        "created_by": current_user.full_name,
        "creator_id": new_topic.creator_id,
        "created_at": new_topic.created_at
    }

@router.get("")
async def get_topics(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get topics list with caching and relationships optimized via DAO
    """
    dao = TopicDAO(db)
    
    filter_status = status_filter
    if current_user.role_id == 5: # Student
        filter_status = "APPROVED"
        if status_filter and status_filter != "APPROVED":
             return {"topics": [], "total": 0}

    topics = await dao.get_all_topics(status=filter_status)
    
    topics_response = []
    for t in topics:
        topics_response.append({
            "topic_id": t.topic_id,
            "title": t.title,
            "description": t.description,
            "requirements": t.requirements,
            "objectives": t.objectives,
            "tech_stack": t.tech_stack,
            "status": t.status,
            "created_by": t.creator.full_name if t.creator else "Unknown",
            "creator_id": t.creator_id,
            "dept_id": t.dept_id,
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
    """
    dao = TopicDAO(db)
    topic = await dao.get_topic_by_id(topic_id)
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    if current_user.role_id == 5 and topic.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view approved topics"
        )
    
    approver_name = None
    if topic.approved_by:
        approver_query = select(User).where(User.user_id == topic.approved_by)
        approver_result = await db.execute(approver_query)
        approver = approver_result.scalar()
        if approver:
            approver_name = approver.full_name
            
    return {
        "topic_id": topic.topic_id,
        "title": topic.title,
        "description": topic.description,
        "requirements": topic.requirements,
        "objectives": topic.objectives,
        "tech_stack": topic.tech_stack,
        "status": topic.status,
        "created_by": topic.creator.full_name if topic.creator else "Unknown",
        "creator_id": topic.creator_id,
        "dept_id": topic.dept_id,
        "created_at": topic.created_at,
        "approved_by": approver_name,
        "approved_at": topic.approved_at
    }

@router.patch("/{topic_id}/approve")
async def approve_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Approve a topic (HEAD_DEPT or ADMIN only)
    """
    if current_user.role_id not in [1, 3]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or heads of department can approve topics"
        )
    
    dao = TopicDAO(db)
    query = select(Topic).where(Topic.topic_id == topic_id)
    result = await db.execute(query)
    topic = result.scalar()
    
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    updated_topic = await dao.update_topic_status(topic, "APPROVED", current_user.user_id)

    # Auto-create a project for this approved topic if possible
    class_result = await db.execute(
        select(AcademicClass)
        .where(AcademicClass.lecturer_id == updated_topic.creator_id)
        .order_by(AcademicClass.class_id.asc())
        .limit(1)
    )
    lecturer_class = class_result.scalars().first()

    if not lecturer_class:
        fallback_result = await db.execute(
            select(AcademicClass).order_by(AcademicClass.class_id.asc()).limit(1)
        )
        lecturer_class = fallback_result.scalars().first()

    if not lecturer_class:
        dept = None
        if updated_topic.dept_id:
            dept_result = await db.execute(
                select(Department).where(Department.dept_id == updated_topic.dept_id)
            )
            dept = dept_result.scalars().first()
        if not dept:
            dept_result = await db.execute(select(Department).order_by(Department.dept_id.asc()).limit(1))
            dept = dept_result.scalars().first()
        if not dept:
            dept = Department(dept_name="General Department")
            db.add(dept)
            await db.commit()
            await db.refresh(dept)

        semester_result = await db.execute(select(Semester).order_by(Semester.semester_id.asc()).limit(1))
        semester = semester_result.scalars().first()
        if not semester:
            semester = Semester(semester_code="GEN-SEM-1", semester_name="General Semester", status="ACTIVE")
            db.add(semester)
            await db.commit()
            await db.refresh(semester)

        subject_result = await db.execute(select(Subject).order_by(Subject.subject_id.asc()).limit(1))
        subject = subject_result.scalars().first()
        if not subject:
            subject = Subject(subject_code="GEN-101", subject_name="General Subject", dept_id=dept.dept_id)
            db.add(subject)
            await db.commit()
            await db.refresh(subject)

        class_result = await db.execute(select(AcademicClass).order_by(AcademicClass.class_id.asc()).limit(1))
        lecturer_class = class_result.scalars().first()
        if not lecturer_class:
            lecturer_class = AcademicClass(
                class_code="GEN-CLASS-1",
                semester_id=semester.semester_id,
                subject_id=subject.subject_id,
                lecturer_id=updated_topic.creator_id,
            )
            db.add(lecturer_class)
            await db.commit()
            await db.refresh(lecturer_class)

    if lecturer_class:
        existing_project_result = await db.execute(
            select(Project)
            .where(
                Project.topic_id == updated_topic.topic_id,
                Project.class_id == lecturer_class.class_id
            )
        )
        existing_project = existing_project_result.scalars().first()

        if not existing_project:
            new_project = Project(
                project_name=updated_topic.title,
                topic_id=updated_topic.topic_id,
                class_id=lecturer_class.class_id,
                status="active",
            )
            db.add(new_project)
            await db.commit()
            await db.refresh(new_project)
    
    return {
        "topic_id": updated_topic.topic_id,
        "status": updated_topic.status,
        "approved_by": current_user.full_name,
        "approved_at": updated_topic.approved_at
    }

@router.patch("/{topic_id}/reject")
async def reject_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reject a topic (HEAD_DEPT or ADMIN only)
    """
    if current_user.role_id not in [1, 3]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or heads of department can reject topics"
        )
    
    dao = TopicDAO(db)
    query = select(Topic).where(Topic.topic_id == topic_id)
    result = await db.execute(query)
    topic = result.scalar()
    
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    updated_topic = await dao.update_topic_status(topic, "REJECTED", current_user.user_id)
    
    return {
        "topic_id": updated_topic.topic_id,
        "status": updated_topic.status,
        "rejected_by": current_user.full_name,
        "rejected_at": updated_topic.approved_at
    }


@router.delete("/{topic_id}")
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

    dao = TopicDAO(db)
    topic = await dao.get_topic_by_id(topic_id)

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

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

    await dao.delete_topic(topic)

    return {
        "topic_id": topic_id,
        "message": "Topic deleted"
    }

# ============================================================================
# EVALUATION ENDPOINTS
# ============================================================================

@router.post("/{topic_id}/evaluate", response_model=EvaluationResponse)
async def create_evaluation(
    topic_id: int,
    eval_data: EvaluationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create evaluation for a team on a topic (Lecturer only)
    """
    if current_user.role_id != 4:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only lecturers can create evaluations"
        )
    
    topic_query = select(Topic).where(Topic.topic_id == topic_id)
    topic_result = await db.execute(topic_query)
    topic = topic_result.scalar()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
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
