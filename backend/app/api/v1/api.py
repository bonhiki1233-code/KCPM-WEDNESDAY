"""Main API router for version 1 endpoints."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.db.session import AsyncSessionLocal, engine
from app.models.all_models import Base, Role

# Create the main API router
api_router = APIRouter()

# ===== PHASE 1 & 2 ENDPOINTS =====

# Auth 
from app.api.v1.auth import router as auth_router
api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])

# Users
from app.api.v1 import users
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Profile
from app.api.v1.profile import router as profile_router
api_router.include_router(profile_router, prefix="/profile", tags=["profile"])

# Academic Classes
from app.api.v1.academic_classes import router as ac_router
api_router.include_router(ac_router, prefix="/academic-classes", tags=["academic-classes"])

# Topics & Evaluation
from app.api.v1.endpoints.topic import router as topics_router
api_router.include_router(topics_router, prefix="/topics", tags=["topics"])

# Teams
from app.api.v1.teams import router as teams_router
api_router.include_router(teams_router, prefix="/teams", tags=["teams"])

# Projects
from app.api.v1.projects import router as projects_router
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])

# Tasks & Sprints
from app.api.v1.tasks import router as tasks_router
api_router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])

# Subjects
from app.api.v1.subjects import router as subjects_router
api_router.include_router(subjects_router, prefix="/subjects", tags=["subjects"])

# Syllabuses
from app.api.v1.syllabuses import router as syllabuses_router
api_router.include_router(syllabuses_router, prefix="/syllabuses", tags=["syllabuses"])

from app.api.v1 import milestones, submissions

api_router.include_router(milestones.router)
api_router.include_router(submissions.router)

# Departments
from app.api.v1.departments import router as departments_router
api_router.include_router(departments_router, prefix="/departments", tags=["departments"])

# Semesters
from app.api.v1.semesters import router as semesters_router
api_router.include_router(semesters_router, prefix="/semesters", tags=["semesters"])

# Class Enrollments
from app.api.v1.class_enrollments import router as enrollments_router
api_router.include_router(enrollments_router, prefix="/enrollments", tags=["enrollments"])

# Notifications
from app.api.v1.notifications import router as notifications_router
api_router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])

# User Import
from app.api.v1.user_import import router as user_import_router
api_router.include_router(user_import_router, prefix="/user-import", tags=["user-import"])

# Bulk Import (Subjects, Classes, Users)
from app.api.v1.import_endpoints import router as import_router
api_router.include_router(import_router, prefix="/admin/import", tags=["admin-import"])

# ===== PHASE 3 ENDPOINTS (Real-time) ✅ =====
# Channels & Messages - Phase 3 Complete
from app.api.v1.channels import router as channels_router
api_router.include_router(channels_router, prefix="/channels", tags=["channels"])
from app.api.v1.messages import router as messages_router
api_router.include_router(messages_router, prefix="/messages", tags=["messages"])

# ===== PHASE 4 ENDPOINTS (AI & Evaluation) =====
# Mentoring - BE1 Implementation
from app.api.v1.mentoring import router as mentoring_router
api_router.include_router(mentoring_router, prefix="/mentoring", tags=["mentoring"])
from app.api.v1.peer_reviews import router as peer_reviews_router
api_router.include_router(peer_reviews_router, prefix="/peer-reviews", tags=["peer-reviews"])

from app.api.v1.meetings import router as meetings_router
api_router.include_router(meetings_router, prefix="/meetings", tags=["meetings"])

# Evaluations - BE4 Implementation
from app.api.v1.evaluations import router as evaluations_router
api_router.include_router(evaluations_router, prefix="/evaluations", tags=["evaluations"])

# Resources - BE4 Implementation
from app.api.v1.resources import router as resources_router
api_router.include_router(resources_router, prefix="/resources", tags=["resources"])


# from app.api.v1.peer_reviews import router as peer_reviews_router
# api_router.include_router(peer_reviews_router, prefix="/peer-reviews", tags=["peer-reviews"])
# from app.api.v1.milestones import router as milestones_router
# api_router.include_router(milestones_router, prefix="/milestones", tags=["milestones"])
# from app.api.v1.submissions import router as submissions_router
# api_router.include_router(submissions_router, prefix="/submissions", tags=["submissions"])

# ===== ADMIN ENDPOINTS (Development Only) =====
@api_router.post("/admin/init-db", tags=["admin"])
async def initialize_database():
    """
    Create all tables and seed initial data.
    ⚠️ USE ONLY IN DEVELOPMENT!
    """
    try:
        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Insert default roles
        async with AsyncSessionLocal() as db:
            # Check if roles already exist
            result = await db.execute(text("SELECT COUNT(*) FROM roles"))
            count = result.scalar()
            
            if count == 0:
                roles_data = [
                    Role(role_id=1, role_name="Admin"),
                    Role(role_id=2, role_name="Staff"),
                    Role(role_id=3, role_name="Head_Dept"),
                    Role(role_id=4, role_name="Lecturer"),
                    Role(role_id=5, role_name="Student"),
                ]
                db.add_all(roles_data)
                await db.commit()
                
                return {
                    "message": "Database initialized successfully",
                    "tables_created": True,
                    "roles_inserted": 5
                }
            else:
                return {
                    "message": "Database already initialized",
                    "tables_created": True,
                    "roles_existing": count
                }
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database initialization failed: {str(e)}")


@api_router.get("/admin/db-status", tags=["admin"])
async def check_database_status():
    """Check if database tables exist."""
    try:
        async with AsyncSessionLocal() as db:
            # Try to count roles
            result = await db.execute(text("SELECT COUNT(*) FROM roles"))
            roles_count = result.scalar()
            
            # Try to count users
            result = await db.execute(text("SELECT COUNT(*) FROM users"))
            users_count = result.scalar()
            
            return {
                "status": "healthy",
                "roles": roles_count,
                "users": users_count
            }
    except Exception as e:
        return {
            "status": "not_initialized",
            "error": str(e)
        }

# Test endpoint
@api_router.get("/test", tags=["system"])
async def test_endpoint():
    return {"message": "Test endpoint works"}