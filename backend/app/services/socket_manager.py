"""
Socket.IO Manager - Phase 3 BE1
Quản lý WebSocket connections và real-time events

Author: BE1
Created: Feb 2026
"""

import socketio
from typing import Dict, Set, Optional
from uuid import UUID
import json
import logging

from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Create Socket.IO server với async mode
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=settings.cors_origins_list,
    logger=True,
    engineio_logger=False
)

# Create ASGI app for Socket.IO
socket_app = socketio.ASGIApp(sio)


class ConnectionManager:
    """Quản lý connections và rooms cho Socket.IO"""
    
    def __init__(self):
        # user_id -> set of socket ids (một user có thể có nhiều connections)
        self.user_connections: Dict[str, Set[str]] = {}
        # socket_id -> user_id
        self.socket_to_user: Dict[str, str] = {}
        # channel_id -> set of socket ids
        self.channel_rooms: Dict[int, Set[str]] = {}
        # team_id -> set of socket ids
        self.team_rooms: Dict[int, Set[str]] = {}
    
    async def connect(self, sid: str, user_id: str):
        """Register a new connection"""
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(sid)
        self.socket_to_user[sid] = user_id
        logger.info(f"User {user_id} connected with socket {sid}")
    
    async def disconnect(self, sid: str):
        """Handle disconnection"""
        user_id = self.socket_to_user.pop(sid, None)
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(sid)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        # Remove from all channel rooms
        for channel_id, sockets in list(self.channel_rooms.items()):
            sockets.discard(sid)
            if not sockets:
                del self.channel_rooms[channel_id]
        
        # Remove from all team rooms
        for team_id, sockets in list(self.team_rooms.items()):
            sockets.discard(sid)
            if not sockets:
                del self.team_rooms[team_id]
        
        logger.info(f"Socket {sid} disconnected")
    
    async def join_channel(self, sid: str, channel_id: int):
        """Join a channel room"""
        if channel_id not in self.channel_rooms:
            self.channel_rooms[channel_id] = set()
        self.channel_rooms[channel_id].add(sid)
        await sio.enter_room(sid, f"channel_{channel_id}")
        logger.info(f"Socket {sid} joined channel_{channel_id}")
    
    async def leave_channel(self, sid: str, channel_id: int):
        """Leave a channel room"""
        if channel_id in self.channel_rooms:
            self.channel_rooms[channel_id].discard(sid)
        await sio.leave_room(sid, f"channel_{channel_id}")
        logger.info(f"Socket {sid} left channel_{channel_id}")
    
    async def join_team(self, sid: str, team_id: int):
        """Join a team room"""
        if team_id not in self.team_rooms:
            self.team_rooms[team_id] = set()
        self.team_rooms[team_id].add(sid)
        await sio.enter_room(sid, f"team_{team_id}")
        logger.info(f"Socket {sid} joined team_{team_id}")
    
    async def leave_team(self, sid: str, team_id: int):
        """Leave a team room"""
        if team_id in self.team_rooms:
            self.team_rooms[team_id].discard(sid)
        await sio.leave_room(sid, f"team_{team_id}")
        logger.info(f"Socket {sid} left team_{team_id}")
    
    def get_user_sockets(self, user_id: str) -> Set[str]:
        """Get all socket ids for a user"""
        return self.user_connections.get(user_id, set())
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if user has any active connections"""
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0


# Global connection manager instance
manager = ConnectionManager()


# ============ SOCKET.IO EVENT HANDLERS ============

@sio.event
async def connect(sid, environ, auth):
    """
    Handle new socket connection.
    Expects auth = {"token": "jwt_token"}
    """
    logger.info(f"New connection attempt: {sid}")
    
    # Extract token from auth
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get('token')
    
    if not token:
        logger.warning(f"Connection rejected - no token: {sid}")
        return False  # Reject connection
    
    # Validate JWT token (import here to avoid circular imports)
    try:
        from app.core.security import verify_token
        payload = verify_token(token)
        if not payload:
            logger.warning(f"Connection rejected - invalid token: {sid}")
            return False
        
        user_id = payload.get("sub")
        if not user_id:
            return False
        
        # Register connection
        await manager.connect(sid, user_id)
        
        # Send connection success
        await sio.emit('connected', {
            'message': 'Connected successfully',
            'user_id': user_id
        }, room=sid)
        
        return True
        
    except Exception as e:
        logger.error(f"Connection error: {e}")
        return False


@sio.event
async def disconnect(sid):
    """Handle socket disconnection"""
    await manager.disconnect(sid)


@sio.event
async def join_channel(sid, data):
    """
    Join a channel room.
    data = {"channel_id": 123}
    """
    channel_id = data.get('channel_id')
    if channel_id:
        await manager.join_channel(sid, channel_id)
        await sio.emit('joined_channel', {
            'channel_id': channel_id,
            'message': f'Joined channel {channel_id}'
        }, room=sid)


@sio.event
async def leave_channel(sid, data):
    """
    Leave a channel room.
    data = {"channel_id": 123}
    """
    channel_id = data.get('channel_id')
    if channel_id:
        await manager.leave_channel(sid, channel_id)


@sio.event
async def join_team(sid, data):
    """
    Join a team room for team-wide updates.
    data = {"team_id": 123}
    """
    team_id = data.get('team_id')
    if team_id:
        await manager.join_team(sid, team_id)
        await sio.emit('joined_team', {
            'team_id': team_id,
            'message': f'Joined team {team_id}'
        }, room=sid)


@sio.event
async def leave_team(sid, data):
    """
    Leave a team room.
    data = {"team_id": 123}
    """
    team_id = data.get('team_id')
    if team_id:
        await manager.leave_team(sid, team_id)


@sio.event
async def typing(sid, data):
    """
    Broadcast typing indicator.
    data = {"channel_id": 123}
    """
    channel_id = data.get('channel_id')
    user_id = manager.socket_to_user.get(sid)
    
    if channel_id and user_id:
        # Broadcast to channel except sender
        await sio.emit('user_typing', {
            'channel_id': channel_id,
            'user_id': user_id
        }, room=f"channel_{channel_id}", skip_sid=sid)


@sio.event
async def new_message(sid, data):
    """
    Handle new message (called from API after saving to DB).
    This is an internal event, typically triggered by the API endpoint.
    data = {"channel_id": 123, "content": "Hello"}
    """
    # Note: Actual message creation should go through REST API
    # This just demonstrates the event structure
    channel_id = data.get('channel_id')
    if channel_id:
        await sio.emit('message_received', data, room=f"channel_{channel_id}")


# ============ BROADCAST FUNCTIONS (called from API endpoints) ============

async def broadcast_message(channel_id: int, message_data: dict):
    """
    Broadcast a new message to all users in a channel.
    Called from messages API after saving message to DB.
    """
    await sio.emit('message_received', {
        'type': 'message:new',
        'channel_id': channel_id,
        'message': message_data
    }, room=f"channel_{channel_id}")


async def broadcast_message_updated(channel_id: int, message_data: dict):
    """Broadcast when a message is edited"""
    await sio.emit('message_updated', {
        'type': 'message:updated',
        'channel_id': channel_id,
        'message': message_data
    }, room=f"channel_{channel_id}")


async def broadcast_message_deleted(channel_id: int, message_id: int):
    """Broadcast when a message is deleted"""
    await sio.emit('message_deleted', {
        'type': 'message:deleted',
        'channel_id': channel_id,
        'message_id': message_id
    }, room=f"channel_{channel_id}")


async def broadcast_task_update(team_id: int, task_data: dict):
    """
    Broadcast task status change to team.
    Called from tasks API after updating task.
    """
    await sio.emit('task_updated', {
        'type': 'task:updated',
        'team_id': team_id,
        'task': task_data
    }, room=f"team_{team_id}")


async def broadcast_team_member_joined(team_id: int, member_data: dict):
    """Broadcast when new member joins team"""
    await sio.emit('team_member_joined', {
        'type': 'team:member_joined',
        'team_id': team_id,
        'member': member_data
    }, room=f"team_{team_id}")


async def broadcast_team_member_left(team_id: int, user_id: str):
    """Broadcast when member leaves team"""
    await sio.emit('team_member_left', {
        'type': 'team:member_left',
        'team_id': team_id,
        'user_id': user_id
    }, room=f"team_{team_id}")


async def send_notification(user_id: str, notification_data: dict):
    """
    Send notification to specific user.
    Called from notification service.
    """
    sockets = manager.get_user_sockets(user_id)
    for sid in sockets:
        await sio.emit('notification', {
            'type': 'notification:new',
            'notification': notification_data
        }, room=sid)


async def broadcast_meeting_started(team_id: int, meeting_data: dict):
    """Broadcast when a meeting starts"""
    await sio.emit('meeting_started', {
        'type': 'meeting:started',
        'team_id': team_id,
        'meeting': meeting_data
    }, room=f"team_{team_id}")


# ============ UTILITY FUNCTIONS ============

def get_online_users() -> list:
    """Get list of online user IDs"""
    return list(manager.user_connections.keys())


def is_user_online(user_id: str) -> bool:
    """Check if a user is currently online"""
    return manager.is_user_online(user_id)
