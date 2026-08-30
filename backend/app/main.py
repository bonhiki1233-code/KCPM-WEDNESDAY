from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.api.v1.api import api_router  # Import from v1 API router
from app.services.socket_manager import socket_app  # Socket.IO - Phase 3 BE1

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Project-Based Learning Management System",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Log database configuration on startup
@app.on_event("startup")
async def startup_event():
    db_url = settings.DATABASE_URL
    # Hide password for security
    db_display = db_url.replace(db_url.split('@')[0].split('://')[1], '****:****')
    logger.info(f"🗄️ DATABASE_URL: {db_display}")
    logger.info(f"📍 Using API prefix: {settings.API_V1_STR}")

# Configure CORS
# Always fall back to permissive origins during local development if none are provided
# Configure CORS
# Always fall back to permissive origins during local development if none are provided
allowed_origins = settings.BACKEND_CORS_ORIGINS or []
# Explicitly add local development origins to ensure they are allowed
allowed_origins.extend(["http://localhost:3000", "http://localhost:5173"])
# Remove duplicates
allowed_origins = list(set(allowed_origins))

# Fallback to "*" if empty (though we just added some)
if not allowed_origins:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

# Mount API routes with /api/v1 prefix
app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve uploaded files
uploads_root = Path(settings.ROOT_DIR) / "uploads"
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_root), name="uploads")

# Mount Socket.IO at /socket.io path - Phase 3 BE1
app.mount("/socket.io", socket_app)

@app.get("/test")
async def test():
    return {"message": "Test from main.py"}

@app.get("/")
async def root():
    """Root endpoint to verify the backend is running."""
    return {
        "message": "Hello from CollabSphere Backend",
        "docs_url": "Go to /docs to see Swagger UI"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}