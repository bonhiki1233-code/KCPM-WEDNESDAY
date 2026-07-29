"""
Mentoring API Endpoints - Phase 4 BE1
AI-powered mentoring suggestions

Author: BE1
Created: Feb 2026
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from app.api.deps import get_db, get_current_user
from app.models.all_models import MentoringLog, Team, TeamMember, User, Task, Sprint, PeerReview
from app.services.ai_service import ai_service
from app.services.notification_service import NotificationService

from pydantic import BaseModel, Field


# ========== CONSTANTS ==========
TEAM_NOT_FOUND = "Team khÃ´ng tá»“n táº¡i"
LOG_NOT_FOUND = "Mentoring log khÃ´ng tá»“n táº¡i"


# ========== SCHEMAS ==========

class MentoringLogCreate(BaseModel):
    team_id: int
    session_notes: Optional[str] = None
    discussion_points: Optional[str] = None
    meeting_date: Optional[datetime] = None


class MentoringLogUpdate(BaseModel):
    session_notes: Optional[str] = None
    discussion_points: Optional[str] = None
    feedback: Optional[str] = None


class MentoringLogResponse(BaseModel):
    log_id: int
    team_id: int
    mentor_id: UUID
    mentor_name: Optional[str] = None
    session_notes: Optional[str]
    discussion_points: Optional[str]
    ai_suggestions: Optional[str]
    feedback: Optional[str]
    meeting_date: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AISuggestionRequest(BaseModel):
    context: Optional[str] = Field(None, description="Additional context for AI")
    include_peer_reviews: bool = Field(True, description="Include peer review data")
    include_tasks: bool = Field(True, description="Include task progress data")


class AISuggestionResponse(BaseModel):
    suggestions: str
    generated_at: datetime
    log_id: int
    context_summary: Optional[str] = None


class TeamProgressResponse(BaseModel):
    team_id: int
    team_name: str
    sprint_velocity: float
    tasks_done: int
    tasks_total: int
    days_remaining: int
    avg_collaboration: Optional[float] = None
    avg_communication: Optional[float] = None
    avg_contribution: Optional[float] = None


# ========== ROUTER ==========

router = APIRouter()


async def get_team_progress(db: AsyncSession, team_id: int) -> dict:
    """Helper để lấy team progress data cho AI"""
    team = await db.get(Team, team_id)
    if not team:
        return {}
    
    # Count tasks via Sprint (Task belongs to Sprint, Sprint belongs to Team)
    tasks_result = await db.execute(
        select(func.count(Task.task_id))
        .join(Sprint, Task.sprint_id == Sprint.sprint_id)
        .where(Sprint.team_id == team_id)
    )
    tasks_total = tasks_result.scalar() or 0
    
    done_result = await db.execute(
        select(func.count(Task.task_id))
        .join(Sprint, Task.sprint_id == Sprint.sprint_id)
        .where(
            Sprint.team_id == team_id,
            Task.status == 'done'
        )
    )
    tasks_done = done_result.scalar() or 0
    
    # Calculate sprint velocity
    sprint_velocity = (tasks_done / tasks_total * 100) if tasks_total > 0 else 0
    
    # Estimate days remaining (simplified - could be enhanced with actual project deadline)
    days_remaining = 14  # Default
    
    # Get peer review averages if available
    avg_collab = avg_comm = avg_contrib = None
    try:
        review_result = await db.execute(
            select(
                func.avg(PeerReview.score)
            ).where(PeerReview.team_id == team_id)
        )
        avg_score = review_result.scalar()
        if avg_score:
            avg_collab = avg_comm = avg_contrib = float(avg_score)
    except:
        pass
    
    return {
        "team_id": team_id,
        "team_name": team.team_name,
        "sprint_velocity": sprint_velocity,
        "tasks_done": tasks_done,
        "tasks_total": tasks_total,
        "days_remaining": days_remaining,
        "avg_collaboration": avg_collab,
        "avg_communication": avg_comm,
        "avg_contribution": avg_contrib
    }


@router.post("/logs", response_model=MentoringLogResponse, status_code=201)
async def create_mentoring_log(
    log_data: MentoringLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Táº¡o mentoring log má»›i.
    Chá»‰ Lecturer (role_id=4) hoáº·c Admin má»›i cÃ³ thá»ƒ táº¡o.
    """
    # Kiá»ƒm tra role
    if current_user.role_id not in [1, 4]:  # Admin or Lecturer
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chá»‰ Lecturer má»›i cÃ³ thá»ƒ táº¡o mentoring log"
        )
    
    # Kiá»ƒm tra team tá»“n táº¡i
    team = await db.get(Team, log_data.team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=TEAM_NOT_FOUND
        )
    
    # Táº¡o log
    new_log = MentoringLog(
        team_id=log_data.team_id,
        mentor_id=current_user.user_id,
        session_notes=log_data.session_notes,
        discussion_points=log_data.discussion_points,
        meeting_date=log_data.meeting_date or datetime.now(timezone.utc)
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    
    return MentoringLogResponse(
        log_id=new_log.log_id,
        team_id=new_log.team_id,
        mentor_id=new_log.mentor_id,
        mentor_name=current_user.full_name,
        session_notes=new_log.session_notes,
        discussion_points=new_log.discussion_points,
        ai_suggestions=new_log.ai_suggestions,
        feedback=new_log.feedback,
        meeting_date=new_log.meeting_date,
        created_at=new_log.created_at
    )


@router.get("/logs", response_model=List[MentoringLogResponse])
async def list_mentoring_logs(
    team_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Láº¥y danh sÃ¡ch mentoring logs cá»§a team.
    Team members vÃ  Lecturers cÃ³ thá»ƒ xem.
    """
    # Kiá»ƒm tra quyá»n truy cáº­p
    member_check = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.user_id
        )
    )
    is_member = member_check.scalar() is not None
    is_lecturer = current_user.role_id in [1, 4]
    
    if not is_member and not is_lecturer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Báº¡n khÃ´ng cÃ³ quyá»n xem mentoring logs cá»§a team nÃ y"
        )
    
    result = await db.execute(
        select(MentoringLog)
        .where(MentoringLog.team_id == team_id)
        .order_by(MentoringLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = result.scalars().all()
    
    response = []
    for log in logs:
        mentor = await db.get(User, log.mentor_id)
        response.append(MentoringLogResponse(
            log_id=log.log_id,
            team_id=log.team_id,
            mentor_id=log.mentor_id,
            mentor_name=mentor.full_name if mentor else "Unknown",
            session_notes=log.session_notes,
            discussion_points=log.discussion_points,
            ai_suggestions=log.ai_suggestions,
            feedback=log.feedback,
            meeting_date=log.meeting_date,
            created_at=log.created_at
        ))
    
    return response


@router.get("/logs/{log_id}", response_model=MentoringLogResponse)
async def get_mentoring_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Láº¥y chi tiáº¿t mentoring log."""
    log = await db.get(MentoringLog, log_id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mentoring log khÃ´ng tá»“n táº¡i"
        )
    
    mentor = await db.get(User, log.mentor_id)
    
    return MentoringLogResponse(
        log_id=log.log_id,
        team_id=log.team_id,
        mentor_id=log.mentor_id,
        mentor_name=mentor.full_name if mentor else "Unknown",
        session_notes=log.session_notes,
        discussion_points=log.discussion_points,
        ai_suggestions=log.ai_suggestions,
        feedback=log.feedback,
        meeting_date=log.meeting_date,
        created_at=log.created_at
    )


@router.put("/logs/{log_id}", response_model=MentoringLogResponse)
async def update_mentoring_log(
    log_id: int,
    update_data: MentoringLogUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cáº­p nháº­t mentoring log.
    Chá»‰ mentor cá»§a log má»›i cÃ³ quyá»n cáº­p nháº­t.
    """
    log = await db.get(MentoringLog, log_id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mentoring log khÃ´ng tá»“n táº¡i"
        )
    
    if log.mentor_id != current_user.user_id and current_user.role_id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chá»‰ mentor má»›i cÃ³ quyá»n cáº­p nháº­t log nÃ y"
        )
    
    if update_data.session_notes is not None:
        log.session_notes = update_data.session_notes
    if update_data.discussion_points is not None:
        log.discussion_points = update_data.discussion_points
    if update_data.feedback is not None:
        log.feedback = update_data.feedback
    
    await db.commit()
    await db.refresh(log)
    
    mentor = await db.get(User, log.mentor_id)
    
    return MentoringLogResponse(
        log_id=log.log_id,
        team_id=log.team_id,
        mentor_id=log.mentor_id,
        mentor_name=mentor.full_name if mentor else "Unknown",
        session_notes=log.session_notes,
        discussion_points=log.discussion_points,
        ai_suggestions=log.ai_suggestions,
        feedback=log.feedback,
        meeting_date=log.meeting_date,
        created_at=log.created_at
    )


@router.delete("/logs/{log_id}", status_code=204)
async def delete_mentoring_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    XÃ³a mentoring log.
    Chá»‰ mentor hoáº·c Admin má»›i cÃ³ quyá»n xÃ³a.
    """
    log = await db.get(MentoringLog, log_id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mentoring log khÃ´ng tá»“n táº¡i"
        )
    
    if log.mentor_id != current_user.user_id and current_user.role_id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chá»‰ mentor má»›i cÃ³ quyá»n xÃ³a log nÃ y"
        )
    
    await db.delete(log)
    await db.commit()
    return None


@router.post("/suggestions", response_model=AISuggestionResponse)
async def generate_ai_suggestions(
    team_id: int,
    request: AISuggestionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Táº¡o AI suggestions cho team.
    Tá»± Ä‘á»™ng táº¡o mentoring log má»›i vá»›i suggestions.
    Chá»‰ Lecturer cÃ³ quyá»n gá»i.
    """
    if current_user.role_id not in [1, 4]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chá»‰ Lecturer má»›i cÃ³ thá»ƒ táº¡o AI suggestions"
        )
    
    # Get team progress
    progress = await get_team_progress(db, team_id)
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team khÃ´ng tá»“n táº¡i"
        )
    
    # Get peer reviews if requested
    peer_reviews = []
    if request.include_peer_reviews:
        reviews_result = await db.execute(
            select(PeerReview).where(PeerReview.team_id == team_id).limit(10)
        )
        for review in reviews_result.scalars().all():
            peer_reviews.append({
                "collaboration_score": review.score,
                "communication_score": review.score,
                "contribution_score": review.score,
                "comment": review.feedback
            })
    
    # Get blockers (tasks with status = blocked) via Sprint join
    blockers = []
    if request.include_tasks:
        blockers_result = await db.execute(
            select(Task.title)
            .join(Sprint, Task.sprint_id == Sprint.sprint_id)
            .where(
                Sprint.team_id == team_id,
                Task.status == 'blocked'
            ).limit(5)
        )
        blockers = [row[0] for row in blockers_result.fetchall()]
    
    # Generate AI suggestions
    suggestions = await ai_service.generate_mentoring_suggestions(
        team_name=progress.get("team_name", "Team"),
        sprint_velocity=progress.get("sprint_velocity", 0),
        tasks_done=progress.get("tasks_done", 0),
        tasks_total=progress.get("tasks_total", 0),
        days_remaining=progress.get("days_remaining", 14),
        peer_reviews=peer_reviews if peer_reviews else None,
        blockers=blockers if blockers else None,
        additional_context=request.context
    )
    
    # Create mentoring log with suggestions
    now = datetime.now(timezone.utc)
    new_log = MentoringLog(
        team_id=team_id,
        mentor_id=current_user.user_id,
        session_notes=f"AI Generated Suggestions - {now.strftime('%Y-%m-%d %H:%M')}",
        ai_suggestions=suggestions,
        meeting_date=now
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    
    # Send notification to team (in background)
    background_tasks.add_task(
        NotificationService.notify_ai_suggestion_ready,
        db, team_id, current_user.full_name
    )
    
    return AISuggestionResponse(
        suggestions=suggestions,
        generated_at=now,
        log_id=new_log.log_id,
        context_summary=f"Sprint: {progress.get('sprint_velocity', 0):.1f}%, Tasks: {progress.get('tasks_done', 0)}/{progress.get('tasks_total', 0)}"
    )


@router.get("/team-progress/{team_id}", response_model=TeamProgressResponse)
async def get_team_progress_endpoint(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Láº¥y thá»‘ng kÃª tiáº¿n Ä‘á»™ team.
    DÃ¹ng Ä‘á»ƒ hiá»ƒn thá»‹ trÆ°á»›c khi generate AI suggestions.
    """
    progress = await get_team_progress(db, team_id)
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team khÃ´ng tá»“n táº¡i"
        )
    
    return TeamProgressResponse(**progress)


@router.post("/analyze-reviews/{team_id}")
async def analyze_team_reviews(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    PhÃ¢n tÃ­ch peer reviews cá»§a team báº±ng AI.
    Chá»‰ Lecturer cÃ³ quyá»n.
    """
    if current_user.role_id not in [1, 4]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chá»‰ Lecturer má»›i cÃ³ thá»ƒ xem phÃ¢n tÃ­ch"
        )
    
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team khÃ´ng tá»“n táº¡i"
        )
    
    # Get reviews
    reviews_result = await db.execute(
        select(PeerReview).where(PeerReview.team_id == team_id)
    )
    reviews = []
    for review in reviews_result.scalars().all():
        reviews.append({
            "collaboration_score": review.score,
            "communication_score": review.score,
            "contribution_score": review.score,
            "comment": review.feedback
        })
    
    if not reviews:
        return {"analysis": "ChÆ°a cÃ³ peer review data Ä‘á»ƒ phÃ¢n tÃ­ch."}
    
    analysis = await ai_service.analyze_peer_reviews(reviews, team.team_name)
    
    return {
        "team_id": team_id,
        "team_name": team.team_name,
        "review_count": len(reviews),
        "analysis": analysis,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

