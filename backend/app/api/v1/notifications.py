"""
FastAPI router for Notification Management.
Endpoints: GET /notifications, POST /notifications/read, GET /notifications/stats, DELETE /notifications/{id}
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.all_models import User, Notification
from app.schemas.notification import (
    NotificationListResponse,
    NotificationMarkRead,
    NotificationResponse,
    NotificationStats
)

router = APIRouter()


# ==========================================
# GET /notifications - List User Notifications
# ==========================================


@router.get(
    "/notifications",
    response_model=NotificationListResponse,
    summary="Get user notifications"
)
async def get_user_notifications(
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    skip: int = Query(0, ge=0, description="Number of notifications to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of notifications to return"),
    unread_only: bool = Query(False, description="Return only unread notifications"),
    notification_type: Optional[str] = Query(None, description="Filter by notification type")
) -> NotificationListResponse:
    """
    Get paginated list of notifications for the current user.
    
    Query Parameters:
    - `skip`: Offset for pagination (default: 0)
    - `limit`: Number of notifications per page (default: 20, max: 100)
    - `unread_only`: Show only unread notifications (default: false)
    - `notification_type`: Filter by type (SYSTEM, MILESTONE, SUBMISSION, TEAM, MENTION, TASK)
    
    Returns:
        NotificationListResponse: List of notifications with total count and unread count
    """
    # Build base query
    query = select(Notification).where(Notification.user_id == current_user.user_id)
    
    # Apply filters
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    if notification_type:
        query = query.where(Notification.type == notification_type.upper())
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    
    # Get unread count
    unread_query = select(func.count()).where(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar_one()
    
    # Get notifications with pagination
    query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return NotificationListResponse(
        total=total,
        unread_count=unread_count,
        notifications=[NotificationResponse.model_validate(n) for n in notifications]
    )


# ==========================================
# POST /notifications/read - Mark as Read
# ==========================================


@router.post(
    "/notifications/read",
    status_code=status.HTTP_200_OK,
    summary="Mark notifications as read"
)
async def mark_notifications_as_read(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    mark_read: NotificationMarkRead
) -> dict:
    """
    Mark one or more notifications as read.
    
    Request Body:
    - `notification_ids`: List of notification IDs to mark as read
    
    Returns:
        Success message with count of updated notifications
        
    Raises:
        HTTPException 404: If no notifications found for the given IDs
    """
    # Update notifications
    stmt = (
        update(Notification)
        .where(
            Notification.notification_id.in_(mark_read.notification_ids),
            Notification.user_id == current_user.user_id,
            Notification.is_read == False
        )
        .values(is_read=True, read_at=func.now())
    )
    
    result = await db.execute(stmt)
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No unread notifications found with the given IDs"
        )
    
    return {
        "message": f"Marked {result.rowcount} notification(s) as read",
        "updated_count": result.rowcount
    }


# ==========================================
# POST /notifications/read-all - Mark All as Read
# ==========================================


@router.post(
    "/notifications/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read"
)
async def mark_all_notifications_as_read(
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)]
) -> dict:
    """
    Mark ALL user notifications as read.
    
    Returns:
        Success message with count of updated notifications
    """
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == current_user.user_id,
            Notification.is_read == False
        )
        .values(is_read=True, read_at=func.now())
    )
    
    result = await db.execute(stmt)
    await db.commit()
    
    return {
        "message": f"Marked {result.rowcount} notification(s) as read",
        "updated_count": result.rowcount
    }


# ==========================================
# GET /notifications/stats - Get Statistics
# ==========================================


@router.get(
    "/notifications/stats",
    response_model=NotificationStats,
    summary="Get notification statistics"
)
async def get_notification_stats(
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)]
) -> NotificationStats:
    """
    Get notification statistics for the current user.
    
    Returns:
        NotificationStats: Total count, unread count, and breakdown by type
    """
    # Get total count
    total_query = select(func.count()).where(Notification.user_id == current_user.user_id)
    total_result = await db.execute(total_query)
    total = total_result.scalar_one()
    
    # Get unread count
    unread_query = select(func.count()).where(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False
    )
    unread_result = await db.execute(unread_query)
    unread = unread_result.scalar_one()
    
    # Get count by type
    by_type_query = select(
        Notification.type,
        func.count(Notification.notification_id).label('count')
    ).where(
        Notification.user_id == current_user.user_id
    ).group_by(Notification.type)
    
    by_type_result = await db.execute(by_type_query)
    by_type = {row.type: row.count for row in by_type_result}
    
    return NotificationStats(
        total=total,
        unread=unread,
        by_type=by_type
    )


# ==========================================
# DELETE /notifications/{notification_id} - Delete Notification
# ==========================================


@router.delete(
    "/notifications/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a notification"
)
async def delete_notification(
    notification_id: int,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)]
) -> None:
    """
    Delete a specific notification.
    
    Args:
        notification_id: ID of notification to delete
        
    Raises:
        HTTPException 404: Notification not found or doesn't belong to user
    """
    stmt = delete(Notification).where(
        Notification.notification_id == notification_id,
        Notification.user_id == current_user.user_id
    )
    
    result = await db.execute(stmt)
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )


# ==========================================
# DELETE /notifications - Delete All Read Notifications
# ==========================================


@router.delete(
    "/notifications",
    status_code=status.HTTP_200_OK,
    summary="Delete all read notifications"
)
async def delete_all_read_notifications(
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)]
) -> dict:
    """
    Delete all read notifications for the current user.
    
    Returns:
        Success message with count of deleted notifications
    """
    stmt = delete(Notification).where(
        Notification.user_id == current_user.user_id,
        Notification.is_read == True
    )
    
    result = await db.execute(stmt)
    await db.commit()
    
    return {
        "message": f"Deleted {result.rowcount} read notification(s)",
        "deleted_count": result.rowcount
    }