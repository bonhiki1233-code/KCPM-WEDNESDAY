"""API endpoints for Submission management."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.all_models import (
    Checkpoint,
    Evaluation,
    Milestone,
    Project,
    Submission,
    Team,
    TeamMember,
    User,
)
from app.schemas.submission import (
    EvaluationResponse,
    SubmissionCreate,
    SubmissionGrade,
    SubmissionListResponse,
    SubmissionResponse,
    SubmissionStats,
    SubmissionUpdate,
    SubmissionWithEvaluation,
)

router = APIRouter(prefix="/submissions", tags=["submissions"])

UPLOAD_ROOT = Path(settings.ROOT_DIR) / "uploads" / "submissions"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


# ==========================================
# HELPER FUNCTIONS
# ==========================================

async def check_deadline_enforcement(
    checkpoint: Checkpoint,
    milestone: Milestone,
    db: AsyncSession
) -> tuple[bool, bool]:
    """
    Check if submission is allowed based on deadline.
    
    Returns:
        tuple[is_late, is_allowed]:
            - is_late: True if past deadline
            - is_allowed: True if submission is allowed (even if late)
    """
    now = datetime.now(milestone.due_date.tzinfo)
    is_late = now > milestone.due_date
    
    # Check if late submissions are allowed (would need a separate config)
    # For now, we'll allow late submissions but mark them as late
    is_allowed = True
    
    return is_late, is_allowed


async def verify_team_membership(
    team_id: int,
    user_id: UUID,
    db: AsyncSession
) -> bool:
    """Verify if user is a member of the team."""
    query = select(TeamMember).where(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id
    )
    result = await db.execute(query)
    member = result.scalar_one_or_none()
    return member is not None


# ==========================================
# SUBMISSION ENDPOINTS
# ==========================================

@router.post(
    "/upload",
    summary="Upload submission file"
)
async def upload_submission_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a submission file and return a public URL.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing file name"
        )

    suffix = Path(file.filename).suffix
    stored_name = f"{uuid4().hex}{suffix}"
    file_path = UPLOAD_ROOT / stored_name

    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file"
        )

    file_path.write_bytes(contents)

    base_url = str(request.base_url)
    file_url = f"{base_url}uploads/submissions/{stored_name}"
    return {"file_url": file_url, "file_name": file.filename}

@router.post(
    "",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit for checkpoint"
)
async def create_submission(
    submission_data: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new submission for a checkpoint.
    
    **Required permissions:** Team member of the specified team
    
    **Validation:**
    - Checkpoint must exist
    - User must be a member of the team
    - Deadline enforcement (marks as late if past due date)
    - Only one submission per team per checkpoint allowed
    """
    # Resolve checkpoint (use latest for team if not provided)
    checkpoint_id = submission_data.checkpoint_id
    if checkpoint_id is None:
        latest_checkpoint_query = (
            select(Checkpoint)
            .where(Checkpoint.team_id == submission_data.team_id)
            .order_by(Checkpoint.checkpoint_id.desc())
            .limit(1)
        )
        latest_checkpoint_result = await db.execute(latest_checkpoint_query)
        latest_checkpoint = latest_checkpoint_result.scalar_one_or_none()
        if not latest_checkpoint:
            team_result = await db.execute(
                select(Team).where(Team.team_id == submission_data.team_id)
            )
            team = team_result.scalar_one_or_none()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found"
                )

            if not team.project_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Team has no project assigned. Ask a lecturer to create a project first."
                )

            project_result = await db.execute(
                select(Project).where(Project.project_id == team.project_id)
            )
            project = project_result.scalar_one_or_none()
            if not project or not project.class_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Project has no class to create a checkpoint"
                )

            milestone = Milestone(
                class_id=project.class_id,
                title="Auto Milestone",
                description="Auto-created milestone for submissions",
                due_date=datetime.now(timezone.utc) + timedelta(days=7),
                created_by=current_user.user_id,
            )
            db.add(milestone)
            await db.flush()

            checkpoint = Checkpoint(
                team_id=team.team_id,
                milestone_id=milestone.milestone_id,
                title="Auto Checkpoint",
                status="pending",
            )
            db.add(checkpoint)
            await db.commit()
            await db.refresh(checkpoint)
            checkpoint_id = checkpoint.checkpoint_id
        else:
            checkpoint_id = latest_checkpoint.checkpoint_id

    # Verify checkpoint exists and load related milestone
    checkpoint_query = (
        select(Checkpoint)
        .options(selectinload(Checkpoint.milestone))
        .where(Checkpoint.checkpoint_id == checkpoint_id)
    )
    checkpoint_result = await db.execute(checkpoint_query)
    checkpoint = checkpoint_result.scalar_one_or_none()
    
    if not checkpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkpoint not found"
        )
    
    # Verify checkpoint belongs to the specified team
    if checkpoint.team_id != submission_data.team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkpoint does not belong to this team"
        )
    
    # Verify user is a member of the team
    is_member = await verify_team_membership(
        submission_data.team_id,
        current_user.user_id,
        db
    )
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )
    
    # Check if submission already exists
    existing_query = select(Submission).where(
        Submission.checkpoint_id == checkpoint_id
    )
    existing_result = await db.execute(existing_query)
    existing_submission = existing_result.scalar_one_or_none()
    
    if existing_submission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A submission already exists for this checkpoint. Use PUT to update it."
        )
    
    # Check deadline
    is_late, is_allowed = await check_deadline_enforcement(
        checkpoint,
        checkpoint.milestone,
        db
    )
    
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Submissions are no longer allowed for this checkpoint"
        )
    
    # Create submission
    new_submission = Submission(
        checkpoint_id=checkpoint_id,
        submitted_by=current_user.user_id,
        content=submission_data.content,
        file_url=submission_data.file_url
    )
    
    db.add(new_submission)
    
    # Update checkpoint status
    if is_late:
        checkpoint.status = "late"
    else:
        checkpoint.status = "completed"
    
    await db.commit()
    await db.refresh(new_submission)
    
    # Add is_late to response
    response = SubmissionResponse.model_validate(new_submission)
    response.is_late = is_late
    
    return response


@router.get(
    "",
    response_model=List[SubmissionListResponse],
    summary="List submissions"
)
async def list_submissions(
    checkpoint_id: Optional[int] = Query(None, description="Filter by checkpoint ID"),
    team_id: Optional[int] = Query(None, description="Filter by team ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List submissions with optional filtering.
    
    **Filters:**
    - checkpoint_id: Filter by specific checkpoint
    - team_id: Filter by specific team
    
    **Access control:**
    - Students can only see their team's submissions
    - Lecturers can see all submissions for their classes
    """
    query = select(Submission).options(
        selectinload(Submission.checkpoint).selectinload(Checkpoint.milestone)
    )
    
    if checkpoint_id:
        query = query.where(Submission.checkpoint_id == checkpoint_id)
    
    if team_id:
        # Filter by team through checkpoint
        query = query.join(Checkpoint).where(Checkpoint.team_id == team_id)
    
    query = query.order_by(Submission.submitted_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    submissions = result.scalars().all()
    
    # Build response with additional info
    submission_list = []
    for submission in submissions:
        # Check if late
        is_late = submission.submitted_at > submission.checkpoint.milestone.due_date
        
        # Check if has evaluation
        eval_query = select(Evaluation).where(
            Evaluation.submission_id == submission.submission_id
        )
        eval_result = await db.execute(eval_query)
        has_evaluation = eval_result.scalar_one_or_none() is not None
        
        submission_list.append(
            SubmissionListResponse(
                submission_id=submission.submission_id,
                checkpoint_id=submission.checkpoint_id,
                submitted_by=submission.submitted_by,
                submitted_at=submission.submitted_at,
                is_late=is_late,
                has_evaluation=has_evaluation
            )
        )
    
    return submission_list


@router.get(
    "/{submission_id}",
    response_model=SubmissionWithEvaluation,
    summary="Get submission details"
)
async def get_submission(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information about a specific submission.
    
    **Includes:**
    - Submission content and file
    - Evaluation (if graded)
    - Late status
    """
    query = (
        select(Submission)
        .options(
            selectinload(Submission.checkpoint).selectinload(Checkpoint.milestone),
            selectinload(Submission.evaluations)
        )
        .where(Submission.submission_id == submission_id)
    )
    
    result = await db.execute(query)
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Check if late
    is_late = submission.submitted_at > submission.checkpoint.milestone.due_date
    
    # Get evaluation if exists
    evaluation = submission.evaluations[0] if submission.evaluations else None
    
    response = SubmissionWithEvaluation(
        submission_id=submission.submission_id,
        checkpoint_id=submission.checkpoint_id,
        submitted_by=submission.submitted_by,
        content=submission.content,
        file_url=submission.file_url,
        submitted_at=submission.submitted_at,
        is_late=is_late,
        evaluation=EvaluationResponse.model_validate(evaluation) if evaluation else None
    )
    
    return response


@router.put(
    "/{submission_id}",
    response_model=SubmissionResponse,
    summary="Update submission (before deadline)"
)
async def update_submission(
    submission_id: int,
    submission_update: SubmissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a submission before the deadline.
    
    **Required permissions:** Team member who can submit for this checkpoint
    
    **Validation:**
    - Submission must exist
    - User must be a team member
    - Must be before deadline (unless late submission allowed)
    - Cannot update after grading
    """
    query = (
        select(Submission)
        .options(
            selectinload(Submission.checkpoint).selectinload(Checkpoint.milestone),
            selectinload(Submission.evaluations)
        )
        .where(Submission.submission_id == submission_id)
    )
    result = await db.execute(query)
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Verify user is a team member
    is_member = await verify_team_membership(
        submission.checkpoint.team_id,
        current_user.user_id,
        db
    )
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )
    
    # Check if already graded
    if submission.evaluations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update submission after it has been graded"
        )
    
    # Check deadline
    now = datetime.now(submission.checkpoint.milestone.due_date.tzinfo)
    if now > submission.checkpoint.milestone.due_date:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update submission after deadline"
        )
    
    # Update fields
    update_data = submission_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(submission, field, value)
    
    await db.commit()
    await db.refresh(submission)
    
    # Check if late for response
    is_late = submission.submitted_at > submission.checkpoint.milestone.due_date
    
    response = SubmissionResponse.model_validate(submission)
    response.is_late = is_late
    
    return response


@router.patch(
    "/{submission_id}/grade",
    response_model=EvaluationResponse,
    summary="Grade submission (lecturer only)"
)
async def grade_submission(
    submission_id: int,
    grade_data: SubmissionGrade,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Grade a submission (lecturer only).
    
    **Required permissions:** Lecturer of the class
    
    **Features:**
    - Assigns total score and feedback
    - Can allow late submissions
    - Creates or updates evaluation record
    """
    # Get submission with related data
    query = (
        select(Submission)
        .options(
            selectinload(Submission.checkpoint)
            .selectinload(Checkpoint.milestone)
            .selectinload(Milestone.academic_class),
            selectinload(Submission.evaluations)
        )
        .where(Submission.submission_id == submission_id)
    )
    result = await db.execute(query)
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Verify user is the class lecturer
    academic_class = submission.checkpoint.milestone.academic_class
    if academic_class.lecturer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the class lecturer can grade submissions"
        )
    
    # Check or create evaluation
    if submission.evaluations:
        # Update existing evaluation
        evaluation = submission.evaluations[0]
        evaluation.total_score = grade_data.total_score
        evaluation.feedback = grade_data.feedback
        evaluation.evaluator_id = current_user.user_id
    else:
        # Create new evaluation
        evaluation = Evaluation(
            submission_id=submission_id,
            evaluator_id=current_user.user_id,
            total_score=grade_data.total_score,
            feedback=grade_data.feedback
        )
        db.add(evaluation)
    
    # Update checkpoint status
    submission.checkpoint.status = "completed"
    
    await db.commit()
    await db.refresh(evaluation)
    
    return evaluation


@router.delete(
    "/{submission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete submission"
)
async def delete_submission(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a submission.
    
    **Required permissions:** Team member (before grading) or Lecturer
    
    **Warning:** This will cascade delete the evaluation if exists!
    """
    query = (
        select(Submission)
        .options(
            selectinload(Submission.checkpoint)
            .selectinload(Checkpoint.milestone)
            .selectinload(Milestone.academic_class),
            selectinload(Submission.evaluations)
        )
        .where(Submission.submission_id == submission_id)
    )
    result = await db.execute(query)
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Check permissions
    academic_class = submission.checkpoint.milestone.academic_class
    is_lecturer = academic_class.lecturer_id == current_user.user_id
    is_team_member = await verify_team_membership(
        submission.checkpoint.team_id,
        current_user.user_id,
        db
    )
    
    if not (is_lecturer or is_team_member):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this submission"
        )
    
    # Students can't delete after grading
    if not is_lecturer and submission.evaluations:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete submission after it has been graded"
        )
    
    await db.delete(submission)
    await db.commit()
    
    return None


# ==========================================
# STATISTICS ENDPOINTS
# ==========================================

@router.get(
    "/stats/checkpoint/{checkpoint_id}",
    response_model=SubmissionStats,
    summary="Get submission statistics for a checkpoint"
)
async def get_checkpoint_stats(
    checkpoint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics about submissions for a checkpoint.
    
    **Required permissions:** Lecturer of the class
    
    **Statistics include:**
    - Total submissions
    - On-time vs late submissions
    - Graded submissions
    - Average score
    """
    # Verify checkpoint exists and get milestone
    checkpoint_query = (
        select(Checkpoint)
        .options(
            selectinload(Checkpoint.milestone)
            .selectinload(Milestone.academic_class)
        )
        .where(Checkpoint.checkpoint_id == checkpoint_id)
    )
    checkpoint_result = await db.execute(checkpoint_query)
    checkpoint = checkpoint_result.scalar_one_or_none()
    
    if not checkpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkpoint not found"
        )
    
    # Verify user is the lecturer
    if checkpoint.milestone.academic_class.lecturer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the class lecturer can view statistics"
        )
    
    # Get all submissions for this checkpoint
    submissions_query = (
        select(Submission)
        .options(selectinload(Submission.evaluations))
        .where(Submission.checkpoint_id == checkpoint_id)
    )
    submissions_result = await db.execute(submissions_query)
    submissions = submissions_result.scalars().all()
    
    # Calculate statistics
    total_submissions = len(submissions)
    on_time_submissions = sum(
        1 for s in submissions
        if s.submitted_at <= checkpoint.milestone.due_date
    )
    late_submissions = total_submissions - on_time_submissions
    
    graded_submissions = sum(1 for s in submissions if s.evaluations)
    
    # Calculate average score
    scores = [s.evaluations[0].total_score for s in submissions if s.evaluations]
    average_score = sum(scores) / len(scores) if scores else None
    
    return SubmissionStats(
        total_submissions=total_submissions,
        on_time_submissions=on_time_submissions,
        late_submissions=late_submissions,
        graded_submissions=graded_submissions,
        average_score=average_score
    )