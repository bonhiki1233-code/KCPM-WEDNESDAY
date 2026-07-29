from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.all_models import Team, TeamMember, User, Meeting, Notification
from app.schemas.meeting import MeetingCreate, MeetingUpdate, MeetingResponse

router = APIRouter()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def gen_peer_room_id() -> str:
    return secrets.token_urlsafe(10)  # PeerJS room id


async def require_team_exists(db: AsyncSession, team_id: int) -> Team:
    r = await db.execute(select(Team).where(Team.team_id == team_id))
    team = r.scalar()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


async def require_team_member(db: AsyncSession, team_id: int, user_id) -> TeamMember:
    r = await db.execute(
        select(TeamMember).where(and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id))
    )
    tm = r.scalar()
    if not tm:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    return tm


def to_response(meeting: Meeting) -> MeetingResponse:
    return MeetingResponse(
        meeting_id=meeting.meeting_id,
        team_id=meeting.team_id,
        title=meeting.title,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        meeting_link=meeting.link_url,
        created_by=meeting.organizer_id,
        created_at=meeting.created_at,
    )


# 1) POST /meetings (schedule meeting)
@router.post("", status_code=status.HTTP_201_CREATED, response_model=MeetingResponse)
async def create_meeting(
    payload: MeetingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_team_exists(db, payload.team_id)
    await require_team_member(db, payload.team_id, current_user.user_id)

    link_url = payload.meeting_link or gen_peer_room_id()

    meeting = Meeting(
        team_id=payload.team_id,
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        link_url=link_url,
        organizer_id=current_user.user_id,
        created_at=now_utc(),
    )
    db.add(meeting)
    await db.flush()  # get meeting.meeting_id

    # Notification: tạo reminder 15 phút trước (lưu record để hệ thống notify xử lý)
    remind_at = payload.start_time - timedelta(minutes=15)
    if remind_at.tzinfo is None:
        # nếu input naive, coi như UTC
        remind_at = remind_at.replace(tzinfo=timezone.utc)

    if remind_at > now_utc():
        members = (await db.execute(select(TeamMember).where(TeamMember.team_id == payload.team_id))).scalars().all()
        for m in members:
            db.add(
                Notification(
                    user_id=m.user_id,
                    title="Meeting reminder",
                    message=f"Meeting '{payload.title}' starts at {payload.start_time.isoformat()}",
                    notification_type="info",
                    related_entity_type="meeting",
                    related_entity_id=meeting.meeting_id,
                )
            )

    await db.commit()
    await db.refresh(meeting)
    return to_response(meeting)


# 2) GET /meetings?team_id={id} (list team meetings)
@router.get("", status_code=status.HTTP_200_OK)
async def list_meetings(
    team_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_team_exists(db, team_id)
    await require_team_member(db, team_id, current_user.user_id)

    r = await db.execute(select(Meeting).where(Meeting.team_id == team_id).order_by(Meeting.start_time.asc()))
    meetings = r.scalars().all()
    return {"team_id": team_id, "total": len(meetings), "meetings": [to_response(m) for m in meetings]}


# 3) GET /meetings/{id} (meeting details)
@router.get("/{meeting_id}", status_code=status.HTTP_200_OK, response_model=MeetingResponse)
async def meeting_detail(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Meeting).where(Meeting.meeting_id == meeting_id))
    meeting = r.scalar()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    await require_team_member(db, meeting.team_id, current_user.user_id)
    return to_response(meeting)


# 4) PUT /meetings/{id} (update meeting)
@router.put("/{meeting_id}", status_code=status.HTTP_200_OK, response_model=MeetingResponse)
async def update_meeting(
    meeting_id: int,
    payload: MeetingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Meeting).where(Meeting.meeting_id == meeting_id))
    meeting = r.scalar()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    tm = await require_team_member(db, meeting.team_id, current_user.user_id)

    # quyền: organizer OR team LEADER OR (Admin/Lecturer theo role_id 1,4)
    is_privileged = current_user.role_id in [1, 4]
    is_leader = (tm.role == "LEADER")
    is_organizer = (meeting.organizer_id == current_user.user_id)
    if not (is_privileged or is_leader or is_organizer):
        raise HTTPException(status_code=403, detail="Not allowed to update this meeting")

    if payload.title is not None:
        meeting.title = payload.title
    if payload.start_time is not None:
        meeting.start_time = payload.start_time
    if payload.end_time is not None:
        meeting.end_time = payload.end_time
    if payload.meeting_link is not None:
        meeting.link_url = payload.meeting_link

    if meeting.start_time and meeting.end_time and meeting.end_time <= meeting.start_time:
        raise HTTPException(status_code=400, detail="end_time must be greater than start_time")

    await db.commit()
    await db.refresh(meeting)
    return to_response(meeting)


# 5) DELETE /meetings/{id} (cancel meeting)
@router.delete("/{meeting_id}", status_code=status.HTTP_200_OK)
async def cancel_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Meeting).where(Meeting.meeting_id == meeting_id))
    meeting = r.scalar()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    tm = await require_team_member(db, meeting.team_id, current_user.user_id)

    is_privileged = current_user.role_id in [1, 4]
    is_leader = (tm.role == "LEADER")
    is_organizer = (meeting.organizer_id == current_user.user_id)
    if not (is_privileged or is_leader or is_organizer):
        raise HTTPException(status_code=403, detail="Not allowed to cancel this meeting")

    await db.delete(meeting)
    await db.commit()
    return {"message": "Meeting cancelled", "meeting_id": meeting_id}


# 6) POST /meetings/{id}/join (join meeting - get PeerJS room)
@router.post("/{meeting_id}/join", status_code=status.HTTP_200_OK)
async def join_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Meeting).where(Meeting.meeting_id == meeting_id))
    meeting = r.scalar()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    await require_team_member(db, meeting.team_id, current_user.user_id)

    if not meeting.link_url:
        meeting.link_url = gen_peer_room_id()
        await db.commit()
        await db.refresh(meeting)

    return {"meeting_id": meeting_id, "team_id": meeting.team_id, "peer_room_id": meeting.link_url}
