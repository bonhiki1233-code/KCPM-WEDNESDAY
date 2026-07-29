from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.api.deps import get_db, get_current_user
from app.models.all_models import PeerReview, Team, TeamMember, User
from app.schemas.peer_review import (
    PeerReviewCreate,
    PeerReviewUpdate,
    PeerReviewResponse,
    PeerReviewAnonymousResponse,
    PeerReviewSummary
)

router = APIRouter()

@router.post("/", response_model=PeerReviewResponse, status_code=201)
async def create_peer_review(
    review_data: PeerReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Tạo peer review.
    Chỉ team members mới có thể review lẫn nhau.
    Không thể tự review chính mình.
    """
    # Không thể tự review chính mình (Logic check)
    if review_data.reviewee_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không thể tự review chính mình"
        )
    
    # Kiểm tra reviewer là team member
    reviewer_check = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == review_data.team_id,
            TeamMember.user_id == current_user.user_id
        )
    )
    if not reviewer_check.scalar():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn phải là thành viên của team mới có thể review"
        )
    
    # Kiểm tra reviewee là team member
    reviewee_check = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == review_data.team_id,
            TeamMember.user_id == review_data.reviewee_id
        )
    )
    if not reviewee_check.scalar():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Người được review phải là thành viên của team"
        )
    
    # Kiểm tra đã review người này chưa (mỗi người chỉ review 1 lần với cùng criteria_name trong cùng sprint?)
    # Logic cũ: "Mỗi người chỉ review 1 lần cho mỗi teammate" (chung chung)
    # Tuy nhiên model có 'criteria_name', nên có thể review nhiều lần với criteria khác nhau.
    # Nhưng để đơn giản theo đề bài: check unique theo (team, reviewer, reviewee, criteria_name) 
    # Hoặc nếu đề bài chỉ yêu cầu "review teammate" nói chung thì có thể check strict hơn.
    # Dựa vào schema có 'criteria_name', ta nên cho phép review nếu criteria khác nhau.
    existing_review = await db.execute(
        select(PeerReview).where(
            PeerReview.team_id == review_data.team_id,
            PeerReview.reviewer_id == current_user.user_id,
            PeerReview.reviewee_id == review_data.reviewee_id,
            PeerReview.criteria_name == review_data.criteria_name
        )
    )
    if existing_review.scalar():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bạn đã review tiêu chí '{review_data.criteria_name}' cho người này rồi"
        )
    
    reviewee = await db.get(User, review_data.reviewee_id)
    
    # Tạo review
    new_review = PeerReview(
        team_id=review_data.team_id,
        reviewer_id=current_user.user_id,
        reviewee_id=review_data.reviewee_id,
        score=review_data.score,
        comment=review_data.comment,
        criteria_name=review_data.criteria_name # Updated field name matching DB
    )
    db.add(new_review)
    await db.commit()
    await db.refresh(new_review)
    
    return PeerReviewResponse(
        review_id=new_review.review_id,
        team_id=new_review.team_id,
        reviewee_id=new_review.reviewee_id,
        reviewee_name=reviewee.full_name if reviewee else "Unknown",
        score=new_review.score,
        comment=new_review.comment,
        criteria_name=new_review.criteria_name,
        created_at=None # Model doesn't have created_at? Wait, checking all_models.py... PeerReview DOES NOT have created_at or updated_at in all_models.py (Step 7). Confirmed.
    )


@router.get("/", response_model=List[PeerReviewResponse])
async def list_peer_reviews(
    team_id: int,
    reviewee_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lấy danh sách peer reviews của team.
    Lecturer/Admin có thể xem tất cả.
    Students chỉ xem được reviews mình tạo hoặc reviews về mình (ẩn danh).
    """
    is_lecturer = current_user.role_id in [1, 4]  # Admin or Lecturer
    
    query = select(PeerReview).where(PeerReview.team_id == team_id)
    
    if reviewee_id:
        query = query.where(PeerReview.reviewee_id == reviewee_id)
        
    # Model PeerReview NO created_at column in all_models.py Step 7.
    # So remove order_by created_at.
    result = await db.execute(query)
    reviews = result.scalars().all()
    
    response = []
    for review in reviews:
        # Check permissions
        # If student (not lecturer/admin):
        # Allow if: I am reviewer OR I am reviewee
        if not is_lecturer:
            if review.reviewer_id != current_user.user_id and review.reviewee_id != current_user.user_id:
                continue

        # reviewer = await db.get(User, review.reviewer_id) # Not needed for response structure used here (anonymous)
        reviewee = await db.get(User, review.reviewee_id)
        
        response.append(PeerReviewResponse(
            review_id=review.review_id,
            team_id=review.team_id,
            reviewee_id=review.reviewee_id,
            reviewee_name=reviewee.full_name if reviewee else "Unknown",
            score=review.score,
            comment=review.comment,
            criteria_name=review.criteria_name,
            created_at=None
        ))
    
    return response


@router.get("/my-reviews", response_model=List[PeerReviewAnonymousResponse])
async def get_my_reviews(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Xem các reviews về mình (ẩn danh).
    """
    result = await db.execute(
        select(PeerReview).where(
            PeerReview.team_id == team_id,
            PeerReview.reviewee_id == current_user.user_id
        )
    )
    reviews = result.scalars().all()
    
    # Fake created_at since DB doesn't have it, or return current time/None in schema
    return [
        PeerReviewAnonymousResponse(
            review_id=r.review_id,
            score=r.score,
            comment=r.comment,
            created_at=datetime.utcnow() # Fallback
        )
        for r in reviews
    ]


@router.get("/summary/{team_id}", response_model=List[PeerReviewSummary])
async def get_team_review_summary(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lấy summary peer reviews của cả team.
    Chỉ Lecturer/Admin mới có quyền xem.
    """
    if current_user.role_id not in [1, 4]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Lecturer mới có quyền xem summary"
        )
    
    # Lấy tất cả members của team
    members_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id)
    )
    members = members_result.scalars().all()
    
    summaries = []
    for member in members:
        user = await db.get(User, member.user_id)
        
        # Tính average score
        avg_result = await db.execute(
            select(func.avg(PeerReview.score)).where(
                PeerReview.team_id == team_id,
                PeerReview.reviewee_id == member.user_id
            )
        )
        avg_score = avg_result.scalar() or 0.0
        
        # Đếm số reviews
        count_result = await db.execute(
            select(func.count(PeerReview.review_id)).where(
                PeerReview.team_id == team_id,
                PeerReview.reviewee_id == member.user_id
            )
        )
        total_reviews = count_result.scalar() or 0
        
        # Lấy comments (feedback)
        feedback_result = await db.execute(
            select(PeerReview.comment).where(
                PeerReview.team_id == team_id,
                PeerReview.reviewee_id == member.user_id,
                PeerReview.comment.isnot(None)
            )
        )
        feedbacks = [f[0] for f in feedback_result.fetchall() if f[0]]
        
        summaries.append(PeerReviewSummary(
            reviewee_id=member.user_id,
            reviewee_name=user.full_name if user else "Unknown",
            average_score=round(float(avg_score), 2),
            total_reviews=total_reviews,
            feedback_summary=feedbacks[:5]  # Top 5 comments
        ))
    
    return summaries


@router.put("/{review_id}", response_model=PeerReviewResponse)
async def update_peer_review(
    review_id: int,
    update_data: PeerReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cập nhật peer review.
    Chỉ reviewer mới có quyền cập nhật.
    """
    review = await db.get(PeerReview, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review không tồn tại"
        )
    
    if review.reviewer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ người tạo review mới có quyền cập nhật"
        )
    
    if update_data.score is not None:
        review.score = update_data.score
    if update_data.comment is not None:
        review.comment = update_data.comment
    
    await db.commit()
    await db.refresh(review)
    
    reviewee = await db.get(User, review.reviewee_id)
    
    return PeerReviewResponse(
        review_id=review.review_id,
        team_id=review.team_id,
        reviewee_id=review.reviewee_id,
        reviewee_name=reviewee.full_name if reviewee else "Unknown",
        score=review.score,
        comment=review.comment,
        criteria_name=review.criteria_name,
        created_at=None
    )


@router.delete("/{review_id}", status_code=204)
async def delete_peer_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Xóa peer review.
    Chỉ reviewer hoặc Admin mới có quyền xóa.
    """
    review = await db.get(PeerReview, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review không tồn tại"
        )
    
    if review.reviewer_id != current_user.user_id and current_user.role_id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa review này"
        )
    
    await db.delete(review)
    await db.commit()
    return None
