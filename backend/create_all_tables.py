"""
Create all database tables.
Run this before init_roles.py
"""
import asyncio
from app.db.session import engine
from app.models.all_models import Base


async def create_tables():
    """Create all tables defined in SQLAlchemy models."""
    print("🚀 Creating database tables...")
    
    async with engine.begin() as conn:
        # Drop all existing tables (use with caution in production!)
        # await conn.run_sync(Base.metadata.drop_all)
        from sqlalchemy import text
        await conn.execute(text("DROP TABLE IF EXISTS departments CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS roles CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS topics CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS projects CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS teams CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS team_members CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS sprints CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS tasks CASCADE"))
        
        await conn.execute(text("DROP TABLE IF EXISTS meetings CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS channels CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS messages CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS milestones CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS checkpoints CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS submissions CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS evaluations CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS evaluation_details CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS evaluation_criteria CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS peer_reviews CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS mentoring_logs CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS resources CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS syllabuses CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS subjects CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS semesters CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS academic_classes CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS class_enrollments CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS system_settings CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS audit_logs CASCADE"))
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ All tables created successfully!")


if __name__ == "__main__":
    asyncio.run(create_tables())
