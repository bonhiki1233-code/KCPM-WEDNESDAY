# CollabSphere AI Coding Instructions

## Project Overview
CollabSphere is a comprehensive **Project-Based Learning Management System** built with FastAPI (backend) and React/Vite (frontend). It manages academic projects with team collaboration, agile methodologies, and AI-powered mentoring.

## Architecture

### Backend (FastAPI)
- **Framework**: FastAPI with SQLAlchemy 2.0
- **Database**: PostgreSQL with complex relational models
- **Cache**: Redis for session management
- **Auth**: JWT tokens with role-based access (Admin, Staff, Head_Dept, Lecturer, Student)
- **AI**: Google Gemini integration for mentoring suggestions
- **Real-time**: Socket.IO for chat and notifications

### Frontend (React)
- **Framework**: React 18 with Vite
- **UI**: Ant Design components
- **Routing**: React Router
- **Real-time**: Socket.IO client + PeerJS for video calls
- **API**: Axios for REST communication

### Data Model Clusters
1. **System Identity**: Users, Roles, Departments, System Settings, Audit Logs
2. **Academic Management**: Semesters, Subjects, Classes, Enrollments
3. **Project Formation**: Topics, Projects, Teams, Team Members
4. **Agile Collaboration**: Sprints, Tasks, Meetings, Channels, Messages
5. **Milestones & Submissions**: Milestones, Checkpoints, Submissions
6. **Evaluation & Resources**: Criteria, Evaluations, Peer Reviews, Mentoring, Resources

## Key Patterns & Conventions

### Database Relationships
- Use **cascade deletes** for dependent entities (e.g., `ondelete="CASCADE"`)
- **Foreign key naming**: `{table}_{column}` (e.g., `user_id`, `team_id`)
- **UUID primary keys** for users, **integer autoincrement** for entities
- **Timezone-aware datetimes**: `DateTime(timezone=True)`

### API Structure
- **Versioned endpoints**: `/api/v1/`
- **Dependency injection**: Use `deps.py` for auth dependencies
- **Pydantic schemas**: Separate input/output models in `schemas/`
- **Service layer**: Business logic in `services/` - services can directly query database using SQLAlchemy

### Pragmatic Service-Layered Architecture
- **Endpoints**: Handle HTTP requests/responses, auth checks, call service functions
- **Services**: Contain business logic (e.g., "assign student to team", "calculate grade") - can execute DB queries directly
- **Models**: SQLAlchemy tables (complete)
- **Schemas**: Pydantic models (complete)
- **No Repository Layer**: Services query database directly for simplicity and development speed
- **Velocity First**: Prioritize getting features working over architectural purity

### Authentication Flow
- **JWT tokens** with 30-minute expiration
- **Role-based access** via `role_id` foreign key
- **CORS configured** for frontend origins (localhost:3000, localhost:5173)

### Development Workflow
- **Docker Compose** for local development (`docker-compose up`)
- **Hot reload** enabled for both backend (uvicorn) and frontend (vite)
- **Health checks** for database and Redis dependencies
- **PowerShell testing** via `test-endpoints.ps1`

### Docker Setup & Troubleshooting
- **Start Docker**: Run `docker desktop start` on Windows before using docker-compose
- **Restart services**: Use `docker-compose restart <service_name>` (e.g., `docker-compose restart backend`)
- **View logs**: Use `docker-compose logs <service_name>` to debug issues
- **Clean restart**: Run `docker-compose down && docker-compose up --build` for fresh start
- **Database persistence**: PostgreSQL and Redis data persist in named volumes

### File Organization
```
backend/app/
├── main.py              # FastAPI app instance + CORS
├── core/config.py       # Pydantic settings from .env (uses API_V1_STR=/api/v1)
├── core/security.py     # JWT utilities ✅ Working
├── db/base.py           # SQLAlchemy DeclarativeBase
├── db/session.py        # Database session management ✅ Working
├── models/all_models.py # Complete SQLAlchemy 2.0 models
├── schemas/             # Pydantic request/response models
└── api/v1/              # API v1 endpoints
    ├── api.py           # Main API router with admin endpoints
    ├── auth.py          # Authentication endpoints
    ├── users.py         # User endpoints
    └── deps.py          # Dependency injection & auth
```

**✅ Architecture (Jan 28, 2026):**
- Using `/api/v1/` versioning (kept as per team's existing code)
- All endpoints under `api/v1/` folder
- Admin endpoints (init-db, db-status) in `api.py`
- Frontend connects to `VITE_API_URL=http://localhost:8000/api/v1`

## Critical Implementation Notes

### Database Setup
- Models are fully defined in `all_models.py` - **do not modify existing relationships**
- Implement `session.py` with async SQLAlchemy engine ✅ **Done**
- Use Alembic for migrations (not yet configured)
- **Environment variables** in `.env` override defaults in `config.py`
- **Supabase Support**: Can migrate to Supabase PostgreSQL using `supabase_migration.py` script
  - Connection format: `postgresql://postgres.[PROJECT-ID]:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres`
  - Use asyncpg driver: `postgresql+asyncpg://...`
  - See [SUPABASE_MIGRATION.md](../SUPABASE_MIGRATION.md) for full instructions

### Authentication Implementation Status ✅
**COMPLETED COMPONENTS:**
1. ✅ **Backend Auth Endpoints**
   - `POST /api/v1/auth/login` - OAuth2 compatible token endpoint
   - `POST /api/v1/auth/register` - User registration with role support
   - `GET /api/v1/users/me` - Get current authenticated user

2. ✅ **Backend Security**
   - JWT token generation & verification in `app/core/security.py`
   - Password hashing with PBKDF2 (MAX_BCRYPT_BYTES = 72 bytes limit)
   - OAuth2PasswordBearer token validation in `app/api/deps.py`
   - Database session management with async SQLAlchemy

3. ✅ **Frontend Auth Integration**
   - `AuthContext.jsx` - Complete auth state management with session persistence
   - `LoginPage.jsx` - Form with email/password inputs
   - `RegisterPage.jsx` - Registration form with role selection
   - Role-based dashboard routing (admin vs student)
   - Idle session timeout with 5-minute auto-logout

4. ✅ **Environment Configuration**
   - Frontend `.env` with `VITE_API_URL=http://localhost:8000/api/v1`
   - Backend `.env` with Supabase PostgreSQL connection
   - Docker-compose overrides DB with local PostgreSQL for local dev

### API Development
- Start with **auth endpoints** (login, register, token refresh)
- Use **dependency injection** for current user (`deps.py`)
- **Role checking** in endpoints (e.g., lecturers only for class management)
- **Pagination** for list endpoints (teams, tasks, messages)

### Login/Registration Flow (Working)
1. User enters email + password on LoginPage
2. FE sends POST to `/api/v1/auth/login` with OAuth2 URLencoded form
3. BE validates credentials, returns JWT access_token
4. FE stores token in localStorage and calls `/api/v1/users/me`
5. FE stores user profile and navigates to appropriate dashboard
6. All subsequent requests include `Authorization: Bearer {token}` header

### Register Flow (Working)
1. User fills email, password, role, full_name on RegisterPage
2. FE sends POST to `/api/v1/auth/register` with JSON body
3. BE validates email uniqueness, hashes password, creates user
4. FE navigates to LoginPage for user to sign in

### Frontend Integration
- **API base URL** from `VITE_API_URL` environment variable
- **Auth tokens** in localStorage with axios interceptors
- **Real-time updates** via Socket.IO for chat and notifications
- **Role-based UI** rendering (different views for students vs lecturers)

### Project Status (February 8, 2026 - Phase 3.5 Import Feature Complete)
**✅ HOÀN THÀNH PHASE 1 + 2 + 3.5 + UI/UX Refinement:**

#### ✅ Recent Implementations (Feb 8, 2026 - Import Feature)
| Feature | Status | Details |
|---------|--------|---------|
| **Import Subjects/Classes/Users** | ✅ Done | CSV/Excel upload with validation, row-by-row error reporting |
| **Download Templates** | ✅ Done | UTF-8 BOM for Vietnamese characters, FileResponse serving |
| **Import History** | ✅ Done | Persisted to database (import_logs table), user-specific logs |
| **View Details Modal** | ✅ Done | Full table of import results with status indicators |
| **Revert Import** | ✅ Done | Cascade delete imported records (subjects/classes only) |
| **Delete History** | ✅ Done | Remove log records from database |
| **Import Logs Table** | ✅ Done | Supabase table with user_id FK, JSON details, indexed queries |

#### ✅ Import Feature Architecture
**Backend Components:**
```
backend/app/
├── models/all_models.py          # Added ImportLog model with User FK
├── schemas/import_log.py         # ImportLogCreate, ImportLogResponse schemas
├── services/import_service.py    # parse_import_file, import_subjects/classes/users
├── api/v1/import_endpoints.py    # 7 endpoints: upload (3), templates (1), logs (3)
└── templates/                    # Static CSV templates with UTF-8 BOM
    ├── subjects_template.csv
    ├── classes_template.csv
    └── users_template.csv
```

**Frontend Components:**
```
frontend/src/
├── components/
│   ├── ImportFilesTab.jsx        # Main UI with cards, history table, actions
│   └── ImportFileModal.jsx       # Upload dialog with drag-drop, results display
└── services/api.js               # importService: upload, download, logs CRUD
```

**Database Schema:**
```sql
import_logs (
  log_id SERIAL PRIMARY KEY,
  user_id UUID FK users(user_id) ON DELETE CASCADE,
  import_type VARCHAR(50),          -- 'subjects', 'classes', 'users'
  total_rows INT, successful INT, failed INT, skipped INT,
  details TEXT,                      -- JSON array of row results
  imported_ids TEXT,                 -- JSON array of created IDs for revert
  created_at TIMESTAMP WITH TIME ZONE,
  INDEX(user_id), INDEX(created_at DESC)
)
```

**API Endpoints (7 new):**
- `POST /api/v1/admin/import/subjects` - Import subjects from CSV/Excel
- `POST /api/v1/admin/import/classes` - Import classes with FK validation
- `POST /api/v1/admin/import/users` - Import users with password hashing
- `GET /api/v1/admin/import/templates/{type}` - Download template CSV
- `POST /api/v1/admin/import/logs` - Save import log to database
- `GET /api/v1/admin/import/logs` - Get user's import history
- `DELETE /api/v1/admin/import/logs/{id}` - Delete import log

**Key Features:**
- ✅ **File Parsing**: Pandas + async I/O for CSV/Excel (UTF-8, UTF-8-BOM encodings)
- ✅ **Validation**: Row-by-row with FK checks (departments, semesters, subjects, lecturers)
- ✅ **Error Handling**: Captures line numbers, skips duplicates, returns detailed results
- ✅ **Atomicity**: Bulk commit after validation (all-or-nothing per import)
- ✅ **Revert**: Stores imported IDs, allows bulk delete via subjectService/classService
- ✅ **User Isolation**: Each user sees only their own import logs
- ✅ **Persistence**: History survives page reloads (database-backed)

**Test Files Created:**
```
test_subjects_import.csv  # 5 test subjects (TEST001-TEST005)
test_classes_import.csv   # 5 test classes (TEST001-01 to TEST004-01)
test_users_import.csv     # 5 test users (test@university.edu)
TEST_IMPORT_REVERT_GUIDE.md  # Comprehensive test scenarios
```

#### ✅ Previous Improvements (Feb 8, 2026)
| Feature | Status | Details |
|---------|--------|---------|
| Admin Dashboard Role-Based Menu | ✅ Done | Admin (full), Staff (Subjects/Classes/Users/Semesters), HeadDept (Classes/Subjects/Topics) |
| Cascade Delete | ✅ Done | Semester, Subject, AcademicClass now cascade delete dependent records |
| Subject Credits Field | ✅ Done | Added credits column to subjects table + UI field + database migration |
| Semester Status Update | ✅ Done | Fixed date validation logic, improved error messages |
| Topic Approval UI | ✅ Done | Fixed "Create project" button behavior, shows Approve/Reject only |
| Class Display Fields | ✅ Done | Subject & Lecturer names now display in table (via lookup maps) |
| Error Messages | ✅ Done | All delete/update operations show detailed error from backend |

#### ✅ API Endpoints Implemented (~112 endpoints - MVP Complete!)
| Module | Endpoints | Status |
|--------|-----------|--------|
| **Phase 1 & 2 - Core System** |
| Auth | login, register | ✅ Done (2) |
| Users | /me, profile, toggle-active | ✅ Done (3) |
| Topics | CRUD, approve, reject, evaluations | ✅ Done (7) |
| Teams | CRUD, join, leave, finalize, select-project | ✅ Done (7) |
| Tasks | CRUD, sprints, status, assign | ✅ Done (10) |
| Projects | CRUD, claim | ✅ Done (4) |
| Academic Classes | CRUD (with cascade delete) | ✅ Done (5) |
| Enrollments | CRUD, bulk | ✅ Done (6) |
| Subjects | CRUD, credits field | ✅ Done (5) |
| Syllabuses | CRUD | ✅ Done (5) |
| Departments | CRUD | ✅ Done (5) |
| Notifications | CRUD | ✅ Done (6) |
| Semesters | CRUD (with status update fix) | ✅ Done (5) |
| Import | upload (3), templates (1), logs (3) | ✅ Done (7) |
| **Phase 3 - Real-time (100% Complete!)** |
| Socket.IO | Infrastructure + events | ✅ Done (BE1) |
| Meetings | CRUD, join | ✅ Done (4) |
| **Channels** | **CRUD** | **✅ Done (4) - Feb 8** |
| **Messages** | **CRUD, real-time broadcast** | **✅ Done (5) - Feb 8** |
| **Phase 4 - AI & Evaluation (100% Complete!)** |
| AI Mentoring | CRUD, suggestions, analytics | ✅ Done (8) |
| Peer Reviews | CRUD, anonymous, summary | ✅ Done (5) |
| Milestones | CRUD, checkpoints | ✅ Done (6) |
| Submissions | CRUD, grading, stats | ✅ Done (5) |
| Resources | CRUD, upload/download | ✅ Done (4) |
| Evaluations | CRUD, criteria | ✅ Done (4) |

**🎉 ALL BACKEND APIs COMPLETE - 112 ENDPOINTS**

#### ✅ Frontend Pages & Services Implemented
**Pages:**
- LoginPage.jsx, RegisterPage.jsx (Auth flow)
- AdminDashboard.jsx (Role-based menus + all management tabs + Import Files tab)
- LecturerDashboard.jsx (Topic management)
- TopicManagement.jsx (CRUD topics)
- ProjectListView.jsx, UserProfile.jsx, SettingsPage.jsx
- ImportFilesTab.jsx (Import management with history persistence)
- ImportFileModal.jsx (Upload dialog with validation and results)

**Services (frontend/src/services/):**
- authService.js - Login, register, toke (Admin, Staff, Head_Dept, Lecturer, Student)
- 40+ SQLAlchemy models with cascade delete relationships
- **import_logs table** with user FK and JSON storage (Phase 3.5)
- **Socket.IO server** mounted at `/socket.io` (Phase 3)
- **Google Gemini API** integration for AI mentoring (Phase 4)
- Database migrations via scripts (alembic backup + manual SQL)
- Docker Compose with hot-reload + health checks
- Redis for Socket.IO pub/sub (multi-instance support)gs + WebRTC (Phase 3) ✅
- **mentoringService.js** - AI mentoring client (Phase 4) ✅
- **peerReviewService.js** - Peer reviews client (Phase 4) ✅
- **milestoneService.js** - Milestones client (Phase 4) ✅
- **submissionService.js** - Submissions client (Phase 4) ✅
- **resourceService.js** - Resources client (Phase 4) ✅
- evaluationService.js - Evaluations client

**Note:** Frontend services for Phase 3 & 4 exist, waiting for backend APIs to be fully connected.

#### ✅ Database & Infrastructure
- Supabase PostgreSQL connected (async pooler)
- 5 roles seeded with proper permissions
- 40+ SQLAlchemy models with cascade delete relationships
- **import_logs table** with user FK and JSON storage
- Database migrations via scripts (alembic backup + manual SQL)
- Docker Compose with hot-reload

#### 📂 Task Assignment Folders
```
Giao_Viec/    → Phase 1 (MVP Foundation) ✅ COMPLETED✅ COMPLETED 100% (Feb 8, 2026)
Giao_Viec_4/  → Phase 4 (AI, Peer Reviews, Advanced Evaluation) ✅ COMPLETED 100%

Note: Giai-doan 3-4/ folder contains all Phase 3 & 4 code
      - Phase 3: All modules implemented (Socket.IO, Meetings, Channels, Messages)
      - Phase 4: All modules complete with full CRUD + AI integration
      
🎉 ALL PHASES COMPLETE - READY FOR UI DEVELOPMENT & TESTING
      - Phase 3: Missing Channels & Messages implementation
      - Phase 4: All modules complete with full CRUD + AI integration
```

#### 🆕 Current Status (Feb 8, 2026 - Phase 3 Complete!)

**Phase 3 Progress: ✅ 100% Complete**
- ✅ Socket.IO Infrastructure (socket_manager.py, notification_service.py) - BE1
- ✅ Meetings API (4 endpoints) + Frontend service
- ✅ **Channels API (4 endpoints)** - **JUST IMPLEMENTED**
- ✅ **Messages API (5 endpoints with Socket.IO real-time)** - **JUST IMPLEMENTED**

**Phase 4 Progress: ✅ 100% Complete**
- ✅ AI Mentoring (8 endpoints) - mentoring.py, ai_service.py
- ✅ Peer Reviews (5 endpoints) - peer_reviews.py
- ✅ Milestones (6 endpoints) - milestones.py
- ✅ Submissions (5 endpoints) - submissions.py
- ✅ Resources (4 endpoints) - resources.py
- ✅ Evaluations (4 endpoints) - evaluations.py
- ✅ All frontend services exist

**🎉 MVP COMPLETE:** All backend APIs implemented!

**Current Total:** ~112 endpoints ✅  
**Phase 1+2:** 65 endpoints  
**Phase 3:** 13 endpoints (Socket.IO + Meetings + Channels + Messages)  
**Phase 4:** 32 endpoints  
**Import Feature:** 7 endpoints  

#### 🎯 Next Steps (Priority Order)
1. **Test Phase 3 APIs** - Use `test-phase3-apis.ps1` script ✅
2. **Test Socket.IO Real-time** - Browser console test
3. **Build Chat UI** (ChatPage.jsx) - Use existing chatService.js
4. **Build Phase 4 UI Pages** - Mentoring, Peer Reviews, Milestones
5. **End-to-end integration testing**
6. **Production deployment preparation**

#### 📋 Quick Commands
```bash
# Start all services
docker-compose up

# Init database
POST http://localhost:8000/api/v1/admin/init-db

# Check API docs
http://localhost:8000/docs

# Frontend
http://localhost:3000
```

### AI Features
- **Google Gemini API** for mentoring suggestions in `MentoringLog.ai_suggestions`
- **Context-aware prompts** using team progress, evaluations, and peer reviews
- **Rate limiting** and error handling for API calls

### Testing & Deployment
- **PowerShell scripts** for endpoint testing
- **Container health checks** ensure service dependencies
- **Volume mounts** for hot reload during development
- **Production secrets** via environment variables (no hardcoded keys)
- **Test Auth Flow**: 
  ```bash
  # 1. Start services
  docker-compose up
  
  # 2. Register new user (POST http://localhost:8000/api/v1/auth/register)
  {
    "email": "student@example.com",
    "password": "password123",
    "role_id": 5,
    "full_name": "Test Student"
  }
  
  # 3. Login (POST http://localhost:8000/api/v1/auth/login)
  # Send as form data: username=student@example.com&password=password123&grant_type=password
  # Returns: {"access_token": "...", "token_type": "bearer"}
  
  # 4. Get user profile (GET http://localhost:8000/api/v1/users/me)
  # Add header: Authorization: Bearer <access_token>
  ```

## Common Tasks
- **User registration**: Create user with role, department, generate UUID
- **Team formation**: Students join via `join_code`, auto-assign to projects
- **Sprint management**: Create tasks under sprints, assign to team members
- **Evaluation workflow**: Lecturers evaluate submissions against criteria
- **Peer reviews**: Team members review each other anonymously
- **Mentoring sessions**: Log meetings with AI-generated suggestions

## Gotchas
- **Cascade deletes** are critical - deleting a team removes all related data
- **Foreign key constraints** prevent orphaned records
- **Timezone handling** - all datetimes should be UTC with timezone info
- **UUID vs Integer keys** - users use UUIDs, most entities use integers
- **Role permissions** - implement checks in API endpoints, not just UI</content>
<parameter name="filePath">d:\Python_Project\WEB TEAMWORK\web app\CollabSphere\CNPM-friday\.github\copilot-instructions.md