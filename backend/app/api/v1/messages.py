"""
Messages API Endpoints - Phase 3
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.all_models import Channel, Message, TeamMember, User

router = APIRouter()


class MessageCreate(BaseModel):
    channel_id: int
    content: str = Field(..., min_length=1, max_length=5000)


class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    message_id: int
    channel_id: int
    sender_id: UUID
    sender_name: Optional[str] = None
    content: Optional[str]
    sent_at: datetime
    is_edited: bool = False

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    messages: List[MessageResponse]
    total: int
    has_more: bool
    skip: int
    limit: int


@router.post("/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await db.get(Channel, message_data.channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Channel không tồn tại"
        )

    member_check = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == channel.team_id,
            TeamMember.user_id == current_user.user_id,
        )
    )
    if not member_check.scalar():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn phải là thành viên của team mới có thể gửi tin nhắn",
        )

    new_message = Message(
        channel_id=message_data.channel_id,
        sender_id=current_user.user_id,
        content=message_data.content,
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)

    return MessageResponse(
        message_id=new_message.message_id,
        channel_id=new_message.channel_id,
        sender_id=new_message.sender_id,
        sender_name=current_user.full_name,
        content=new_message.content,
        sent_at=new_message.sent_at,
        is_edited=False,
    )


@router.get("/", response_model=MessageListResponse)
async def list_messages(
    channel_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Channel không tồn tại"
        )

    member_check = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == channel.team_id,
            TeamMember.user_id == current_user.user_id,
        )
    )
    if not member_check.scalar():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem tin nhắn trong channel này",
        )

    count_result = await db.execute(
        select(func.count()).where(Message.channel_id == channel_id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Message)
        .where(Message.channel_id == channel_id)
        .order_by(desc(Message.sent_at))
        .offset(skip)
        .limit(limit + 1)
    )
    messages = result.scalars().all()

    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    response_messages = []
    for msg in messages:
        sender = await db.get(User, msg.sender_id)
        sender_name = sender.full_name if sender else "Unknown"

        response_messages.append(
            MessageResponse(
                message_id=msg.message_id,
                channel_id=msg.channel_id,
                sender_id=msg.sender_id,
                sender_name=sender_name,
                content=msg.content,
                sent_at=msg.sent_at,
                is_edited=False,
            )
        )

    response_messages.reverse()

    return MessageListResponse(
        messages=response_messages,
        total=total,
        has_more=has_more,
        skip=skip,
        limit=limit,
    )


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tin nhắn không tồn tại"
        )

    sender = await db.get(User, message.sender_id)

    return MessageResponse(
        message_id=message.message_id,
        channel_id=message.channel_id,
        sender_id=message.sender_id,
        sender_name=sender.full_name if sender else "Unknown",
        content=message.content,
        sent_at=message.sent_at,
        is_edited=False,
    )


@router.patch("/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: int,
    update_data: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tin nhắn không tồn tại"
        )

    if message.sender_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn chỉ có thể sửa tin nhắn của chính mình",
        )

    message.content = update_data.content

    await db.commit()
    await db.refresh(message)

    return MessageResponse(
        message_id=message.message_id,
        channel_id=message.channel_id,
        sender_id=message.sender_id,
        sender_name=current_user.full_name,
        content=message.content,
        sent_at=message.sent_at,
        is_edited=True,
    )


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tin nhắn không tồn tại"
        )

    if message.sender_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa tin nhắn này",
        )

    await db.delete(message)
    await db.commit()
    return None
