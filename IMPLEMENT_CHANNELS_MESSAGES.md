# Quick Implementation Guide: Channels & Messages APIs

**Estimated Time:** 1.5 hours  
**Target:** Complete Phase 3 (40% → 100%)  
**Missing:** 9 endpoints (Channels: 4, Messages: 5)

---

## Prerequisites ✅

- ✅ Socket.IO infrastructure already set up (`socket_manager.py`)
- ✅ Models already exist in `all_models.py` (Channel, Message tables)
- ✅ Frontend services ready (`chatService.js`, `socketService.js`)
- ✅ Starter code available in `Giai-doan 3-4/Giao_Viec_3/CODE/be/`

---

## Step 1: Implement Channels API (30 minutes)

### 1.1 Copy Starter Code
```bash
# From workspace root
cp "Giai-doan 3-4/Giao_Viec_3/CODE/be/channels.py" "backend/app/api/v1/channels.py"
```

### 1.2 Create Schema File
Create `backend/app/schemas/channel.py`:

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ChannelCreate(BaseModel):
    team_id: int
    name: str = Field(..., min_length=1, max_length=100)
    type: Optional[str] = "general"

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
```

### 1.3 Update channels.py Imports
Edit `backend/app/api/v1/channels.py` line 14, replace:
```python
# from app.schemas.channel import ChannelCreate, ChannelUpdate, ChannelResponse
```
With:
```python
from app.schemas.channel import ChannelCreate, ChannelUpdate, ChannelResponse
```

Then delete the inline schemas (lines 20-47 in starter code).

### 1.4 Register Router
Edit `backend/app/api/v1/api.py` - uncomment lines 86-87:
```python
from app.api.v1.channels import router as channels_router
api_router.include_router(channels_router, prefix="/channels", tags=["channels"])
```

### 1.5 Test Endpoints
```bash
# Restart backend
docker-compose restart backend

# Test in browser
http://localhost:8000/docs

# Expected new endpoints:
POST   /api/v1/channels
GET    /api/v1/channels?team_id=1
PUT    /api/v1/channels/{id}
DELETE /api/v1/channels/{id}
```

---

## Step 2: Implement Messages API (1 hour)

### 2.1 Copy Starter Code
```bash
# From workspace root
cp "Giai-doan 3-4/Giao_Viec_3/CODE/be/messages.py" "backend/app/api/v1/messages.py"
```

### 2.2 Create Schema File
Create `backend/app/schemas/message.py`:

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID

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
```

### 2.3 Update messages.py Imports
Edit `backend/app/api/v1/messages.py` line 15, replace inline schemas with:
```python
from app.schemas.message import MessageCreate, MessageUpdate, MessageResponse, MessageListResponse
```

Then delete the inline schemas (lines 20-52 in starter code).

### 2.4 Add Socket.IO Integration
In `messages.py`, add at the top (after imports):
```python
from app.services.socket_manager import manager
```

Then in the `create_message` endpoint, add after `db.commit()`:
```python
# Broadcast to channel via Socket.IO
message_data = {
    "message_id": message.message_id,
    "channel_id": message.channel_id,
    "sender_id": str(message.sender_id),
    "sender_name": current_user.full_name,
    "content": message.content,
    "sent_at": message.sent_at.isoformat()
}
await manager.broadcast_message(message.channel_id, message_data)
```

### 2.5 Register Router
Edit `backend/app/api/v1/api.py` - uncomment lines 88-89:
```python
from app.api.v1.messages import router as messages_router
api_router.include_router(messages_router, prefix="/messages", tags=["messages"])
```

### 2.6 Test Endpoints
```bash
# Restart backend
docker-compose restart backend

# Test in browser
http://localhost:8000/docs

# Expected new endpoints:
POST   /api/v1/messages
GET    /api/v1/messages?channel_id=1&skip=0&limit=50
PUT    /api/v1/messages/{id}
DELETE /api/v1/messages/{id}
POST   /api/v1/messages/typing
```

### 2.7 Test Real-time (Optional)
Open 2 browser windows:

**Window 1:**
```javascript
// Open browser console
const socket = io('http://localhost:8000', { path: '/socket.io' });
socket.on('connect', () => console.log('Connected:', socket.id));
socket.emit('join_channel', { channel_id: 1 });
socket.on('message:new', (data) => console.log('New message:', data));
```

**Window 2:**
```bash
# Send message via API (use Swagger docs or curl)
POST /api/v1/messages
{
  "channel_id": 1,
  "content": "Test real-time message"
}

# Window 1 console should display the message
```

---

## Step 3: Verification Checklist

### ✅ Files Created
- [ ] `backend/app/schemas/channel.py`
- [ ] `backend/app/schemas/message.py`
- [ ] `backend/app/api/v1/channels.py`
- [ ] `backend/app/api/v1/messages.py`

### ✅ Code Changes
- [ ] Uncommented lines 86-89 in `backend/app/api/v1/api.py`
- [ ] Added Socket.IO broadcast in messages.py

### ✅ Backend Tests
- [ ] `docker-compose restart backend` runs without errors
- [ ] Swagger docs show 9 new endpoints
- [ ] POST /channels creates channel successfully
- [ ] GET /channels returns list
- [ ] POST /messages creates message
- [ ] GET /messages returns paginated list
- [ ] Socket.IO connection works (test in console)

### ✅ Frontend Integration (Next Step)
- [ ] Update `chatService.js` to use new endpoints
- [ ] Build ChatPage.jsx component
- [ ] Test real-time message updates
- [ ] Build ChannelList.jsx sidebar

---

## Troubleshooting

### Error: "No module named 'app.schemas.channel'"
**Solution:** Make sure you created `backend/app/schemas/channel.py` and restarted backend.

### Error: "Table 'channels' doesn't exist"
**Solution:** Run database initialization:
```bash
POST http://localhost:8000/api/v1/admin/init-db
```

### Error: Socket.IO not broadcasting
**Solution:** Check if Socket.IO is mounted in `main.py`:
```python
from app.services.socket_manager import socket_app
app.mount("/socket.io", socket_app)
```

### Error: "Channel not found"
**Solution:** Create a channel first:
```bash
POST /api/v1/channels
{
  "team_id": 1,
  "name": "general",
  "type": "team"
}
```

---

## Post-Implementation Tasks

### 1. Update API Documentation
```bash
# Swagger automatically updates at http://localhost:8000/docs
# Update PHASE_3_4_STATUS.md endpoint count from 103 → 112
```

### 2. Test with Frontend
```bash
# In frontend/src/services/chatService.js
# Already has methods defined, just needs API connections:
- chatService.getChannels(teamId)
- chatService.sendMessage(channelId, content)
- chatService.getMessages(channelId, skip, limit)
- chatService.updateMessage(messageId, content)
- chatService.deleteMessage(messageId)
```

### 3. Build Chat UI (Next Phase)
Priority order:
1. ChatPage.jsx - Main container
2. ChannelList.jsx - Sidebar with channels
3. MessageList.jsx - Message display
4. MessageInput.jsx - Send message form
5. Integrate socketService.js for real-time

---

## Expected Results

### Before Implementation
- 103 endpoints
- Phase 3: 40% complete
- Missing: Channels & Messages

### After Implementation
- 112 endpoints ✅
- Phase 3: 100% complete ✅
- Missing: None ✅

### API Endpoint Count
| Module | Before | After |
|--------|--------|-------|
| Channels | 0 | 4 |
| Messages | 0 | 5 |
| **Total** | **103** | **112** |

---

## Quick Commands Reference

```bash
# Copy files
cp "Giai-doan 3-4/Giao_Viec_3/CODE/be/channels.py" "backend/app/api/v1/channels.py"
cp "Giai-doan 3-4/Giao_Viec_3/CODE/be/messages.py" "backend/app/api/v1/messages.py"

# Restart backend
docker-compose restart backend

# View logs
docker-compose logs backend --tail=50

# Test endpoints
curl http://localhost:8000/api/v1/channels
curl http://localhost:8000/api/v1/messages

# Or use Swagger UI
# http://localhost:8000/docs
```

---

## Success Criteria

✅ All 9 endpoints accessible at `/api/v1/channels` and `/api/v1/messages`  
✅ Swagger docs show complete API documentation  
✅ Socket.IO broadcasts messages in real-time  
✅ Frontend chatService.js can connect to APIs  
✅ Phase 3 marked as 100% complete  

**Total Time:** ~1.5 hours for implementation + testing

---

**Guide Created:** February 8, 2026  
**Complexity:** ⭐⭐ Medium (copy & configure)  
**Impact:** 🚀 High (completes Phase 3)
