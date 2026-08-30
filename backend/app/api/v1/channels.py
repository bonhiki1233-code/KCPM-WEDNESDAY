"""
Channels API Endpoints - Phase 3
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.all_models import Channel, Message, TeamMember, User

router = APIRouter()


class ChannelCreate(BaseModel):
    team_id: int
    name: str = Field(..., min_length=1, max_length=100)
    type: Optional[str] = "general"
    description: Optional[str] = None


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None


class ChannelResponse(BaseModel):
    channel_id: int
    team_id: int
    name: Optional[str]
    type: Optional[str]
    created_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


@router.post("/", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    channel_data: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member_check = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == channel_data.team_id,
            TeamMember.user_id == current_user.user_id,
        )
    )
    if not member_check.scalar():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn phải là thành viên của team mới có thể tạo channel",
        )

    new_channel = Channel(
        team_id=channel_data.team_id,
        name=channel_data.name,
        type=channel_data.type or "general",
    )
    db.add(new_channel)
    await db.commit()
    await db.refresh(new_channel)

    return ChannelResponse(
        channel_id=new_channel.channel_id,
        team_id=new_channel.team_id,
        name=new_channel.name,
        type=new_channel.type,
        created_at=new_channel.created_at,
        message_count=0,
    )


@router.get("/", response_model=List[ChannelResponse])
async def list_channels(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member_check = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.user_id,
        )
    )
    if not member_check.scalar():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn phải là thành viên của team mới có thể xem channels",
        )

    result = await db.execute(select(Channel).where(Channel.team_id == team_id))
    channels = result.scalars().all()

    if not channels:
        default_channel = Channel(team_id=team_id, name="general", type="general")
        db.add(default_channel)
        await db.commit()
        await db.refresh(default_channel)
        channels = [default_channel]

    response = []
    for channel in channels:
        msg_count = await db.execute(
            select(func.count()).where(Message.channel_id == channel.channel_id)
        )
        count = msg_count.scalar() or 0

        response.append(
            ChannelResponse(
                channel_id=channel.channel_id,
                team_id=channel.team_id,
                name=channel.name,
                type=channel.type,
                created_at=channel.created_at,
                message_count=count,
            )
        )

    return response


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel(
    channel_id: int,
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
            detail="Bạn không có quyền xem channel này",
        )

    msg_count = await db.execute(
        select(func.count()).where(Message.channel_id == channel_id)
    )
    count = msg_count.scalar() or 0

    return ChannelResponse(
        channel_id=channel.channel_id,
        team_id=channel.team_id,
        name=channel.name,
        type=channel.type,
        created_at=channel.created_at,
        message_count=count,
    )


@router.put("/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: int,
    update_data: ChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Channel không tồn tại"
        )

    if update_data.name is not None:
        channel.name = update_data.name
    if update_data.type is not None:
        channel.type = update_data.type

    await db.commit()
    await db.refresh(channel)

    msg_count = await db.execute(
        select(func.count()).where(Message.channel_id == channel_id)
    )
    count = msg_count.scalar() or 0

    return ChannelResponse(
        channel_id=channel.channel_id,
        team_id=channel.team_id,
        name=channel.name,
        type=channel.type,
        created_at=channel.created_at,
        message_count=count,
    )


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Channel không tồn tại"
        )

    await db.delete(channel)
    await db.commit()
    return None
