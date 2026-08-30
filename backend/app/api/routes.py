"""
Main API router - Flat architecture without versioning.
All API routes are registered here.
"""
from fastapi import APIRouter

# Import routers from endpoints
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.admin import router as admin_router

# Create main API router
api_router = APIRouter()

# Register authentication routes
api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])

# Register user routes
api_router.include_router(users_router, prefix="/users", tags=["users"])

# Register admin routes (development only)
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])

# Health check for API
@api_router.get("/health", tags=["system"])
async def api_health():
    """API health check endpoint."""
    return {"status": "healthy", "message": "API is running"}
