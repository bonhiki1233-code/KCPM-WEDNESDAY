"""
Notification Service - Phase 3 BE1
Quản lý real-time notifications

Author: BE1
Created: Feb 2026
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.all_models import Notification, User
from app.services.socket_manager import send_notification, sio
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Service để tạo và gửi notifications real-time"""
    
    # Notification types
    TYPE_MESSAGE = "message"
    TYPE_TASK = "task"
    TYPE_TEAM = "team"
    TYPE_MEETING = "meeting"
    TYPE_DEADLINE = "deadline"
    TYPE_PEER_REVIEW = "peer_review"
    TYPE_MENTORING = "mentoring"
    TYPE_SYSTEM = "system"
    
    @staticmethod
    async def create_and_send(
        db: AsyncSession,
        user_id: UUID,
        title: str,
        content: str,
        notification_type: str = "system",
        link: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> Notification:
        """
        Tạo notification trong DB và gửi real-time.
        
        Args:
            db: Database session
            user_id: ID của user nhận notification
            title: Tiêu đề notification
            content: Nội dung notification
            notification_type: Loại notification (message, task, team, etc.)
            link: Link liên quan (optional)
            metadata: Thông tin bổ sung (optional)
        
        Returns:
            Notification object đã được tạo
        """
        # Create notification in DB
        notification = Notification(
            user_id=user_id,
            title=title,
            content=content,
            type=notification_type,
            link=link,
            is_read=False
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        
        # Send real-time notification
        notification_data = {
            "notification_id": notification.notification_id,
            "title": notification.title,
            "content": notification.content,
            "type": notification.type,
            "link": notification.link,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
            "metadata": metadata
        }
        
        try:
            await send_notification(str(user_id), notification_data)
            logger.info(f"Notification sent to user {user_id}")
        except Exception as e:
            logger.error(f"Failed to send real-time notification: {e}")
        
        return notification
    
    @staticmethod
    async def send_to_team(
        db: AsyncSession,
        team_id: int,
        title: str,
        content: str,
        notification_type: str = "team",
        exclude_user: Optional[UUID] = None
    ) -> List[Notification]:
        """
        Gửi notification cho tất cả members trong team.
        
        Args:
            db: Database session
            team_id: ID của team
            title: Tiêu đề notification
            content: Nội dung notification
            notification_type: Loại notification
            exclude_user: User ID để loại trừ (ví dụ: người gửi)
        
        Returns:
            List of created notifications
        """
        from app.models.all_models import TeamMember
        
        # Get all team members
        result = await db.execute(
            select(TeamMember.user_id).where(TeamMember.team_id == team_id)
        )
        member_ids = [row[0] for row in result.fetchall()]
        
        notifications = []
        for user_id in member_ids:
            if exclude_user and user_id == exclude_user:
                continue
            
            notification = await NotificationService.create_and_send(
                db=db,
                user_id=user_id,
                title=title,
                content=content,
                notification_type=notification_type
            )
            notifications.append(notification)
        
        return notifications
    
    @staticmethod
    async def notify_new_message(
        db: AsyncSession,
        channel_id: int,
        sender_id: UUID,
        sender_name: str,
        message_preview: str
    ):
        """
        Notify team members about new message.
        Note: Real-time broadcast is done via socket_manager.broadcast_message
        This creates persistent notifications for offline users.
        """
        from app.models.all_models import Channel, TeamMember
        
        # Get channel's team
        channel = await db.get(Channel, channel_id)
        if not channel:
            return
        
        # Get team members except sender
        result = await db.execute(
            select(TeamMember.user_id).where(
                TeamMember.team_id == channel.team_id,
                TeamMember.user_id != sender_id
            )
        )
        member_ids = [row[0] for row in result.fetchall()]
        
        for user_id in member_ids:
            await NotificationService.create_and_send(
                db=db,
                user_id=user_id,
                title=f"New message from {sender_name}",
                content=message_preview[:100] + "..." if len(message_preview) > 100 else message_preview,
                notification_type=NotificationService.TYPE_MESSAGE,
                link=f"/channels/{channel_id}"
            )
    
    @staticmethod
    async def notify_task_assigned(
        db: AsyncSession,
        task_id: int,
        task_title: str,
        assignee_id: UUID,
        assigner_name: str
    ):
        """Notify user when task is assigned to them"""
        await NotificationService.create_and_send(
            db=db,
            user_id=assignee_id,
            title="Task Assigned",
            content=f"{assigner_name} assigned you task: {task_title}",
            notification_type=NotificationService.TYPE_TASK,
            link=f"/tasks/{task_id}"
        )
    
    @staticmethod
    async def notify_task_completed(
        db: AsyncSession,
        team_id: int,
        task_title: str,
        completer_id: UUID,
        completer_name: str
    ):
        """Notify team when task is completed"""
        await NotificationService.send_to_team(
            db=db,
            team_id=team_id,
            title="Task Completed",
            content=f"{completer_name} completed task: {task_title}",
            notification_type=NotificationService.TYPE_TASK,
            exclude_user=completer_id
        )
    
    @staticmethod
    async def notify_meeting_scheduled(
        db: AsyncSession,
        team_id: int,
        meeting_title: str,
        organizer_name: str,
        start_time: datetime
    ):
        """Notify team about new meeting"""
        formatted_time = start_time.strftime("%d/%m/%Y %H:%M")
        await NotificationService.send_to_team(
            db=db,
            team_id=team_id,
            title="Meeting Scheduled",
            content=f"{organizer_name} scheduled meeting: {meeting_title} at {formatted_time}",
            notification_type=NotificationService.TYPE_MEETING
        )
    
    @staticmethod
    async def notify_meeting_starting_soon(
        db: AsyncSession,
        meeting_id: int,
        team_id: int,
        meeting_title: str,
        minutes_until: int = 15
    ):
        """Notify team that meeting is starting soon"""
        await NotificationService.send_to_team(
            db=db,
            team_id=team_id,
            title="Meeting Starting Soon",
            content=f"Meeting '{meeting_title}' starts in {minutes_until} minutes",
            notification_type=NotificationService.TYPE_MEETING,
        )
    
    @staticmethod
    async def notify_peer_review_requested(
        db: AsyncSession,
        user_id: UUID,
        team_name: str,
        sprint_name: str
    ):
        """Notify user that peer review is requested"""
        await NotificationService.create_and_send(
            db=db,
            user_id=user_id,
            title="Peer Review Requested",
            content=f"Please review your teammates for {sprint_name} in {team_name}",
            notification_type=NotificationService.TYPE_PEER_REVIEW,
            link="/peer-reviews"
        )
    
    @staticmethod
    async def notify_ai_suggestion_ready(
        db: AsyncSession,
        team_id: int,
        mentor_name: str
    ):
        """Notify team about new AI mentoring suggestions"""
        await NotificationService.send_to_team(
            db=db,
            team_id=team_id,
            title="New Mentoring Suggestions",
            content=f"{mentor_name} has generated new AI mentoring suggestions for your team",
            notification_type=NotificationService.TYPE_MENTORING,
            link="/mentoring"
        )


# Export singleton
notification_service = NotificationService()
