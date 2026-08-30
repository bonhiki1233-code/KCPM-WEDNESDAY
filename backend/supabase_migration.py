"""
Supabase Database Migration Script

Instructions:
1. Set environment variables:
   - SUPABASE_URL: Your Supabase project URL
   - DATABASE_URL: Your Supabase PostgreSQL connection string
     Format: postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres

2. Run this script: python supabase_migration.py

To get your DATABASE_URL from Supabase:
- Go to Settings > Database > Connection String
- Copy the PostgreSQL connection string
- Replace [YOUR-PASSWORD] with your database password
"""

import asyncio
import sys
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Load environment variables
load_dotenv()

# Import your models
from app.db.base import Base
from app.models.all_models import (
    Role, Department, User, SystemSetting, AuditLog,
    Semester, Subject, Syllabus, AcademicClass, ClassEnrollment,
    Topic, Project, Team, TeamMember,
    Sprint, Task, Meeting, Channel, Message,
    Milestone, Checkpoint, Submission,
    EvaluationCriterion, Evaluation, EvaluationDetail, PeerReview, MentoringLog,
    Resource
)


async def migrate_to_supabase(database_url: str):
    """
    Create all tables in Supabase PostgreSQL database.
    
    Args:
        database_url: PostgreSQL connection string from Supabase
    """
    
    # Use asyncpg driver for PostgreSQL
    if not database_url.startswith("postgresql+asyncpg://"):
        # Convert standard postgresql:// to asyncpg
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    
    print(f"Connecting to database: {database_url.split('@')[1] if '@' in database_url else 'unknown'}")
    
    # Create async engine with extended timeout
    engine = create_async_engine(
        database_url,
        echo=True,  # Print SQL statements
        pool_pre_ping=True,
        connect_args={
            "timeout": 60,
            "command_timeout": 60,
            "server_settings": {"application_name": "CollabSphere_Migration"}
        }
    )
    
    try:
        async with engine.begin() as conn:
            # Create all tables
            print("\n📊 Creating all tables...")
            await conn.run_sync(Base.metadata.create_all)
            print("✅ All tables created successfully!")
            
            # Verify tables were created
            result = await conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """))
            
            tables = result.fetchall()
            print(f"\n📋 Created {len(tables)} tables:")
            for table in tables:
                print(f"  - {table[0]}")
                
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        sys.exit(1)
    finally:
        await engine.dispose()


def get_database_url_from_env():
    """Get database URL from environment variables."""
    import os
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL environment variable not set!")
        print("\nTo use Supabase:")
        print("1. Go to Supabase Dashboard > Settings > Database > Connection String")
        print("2. Copy the PostgreSQL connection string")
        print("3. Set: export DATABASE_URL='postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres'")
        sys.exit(1)
    return db_url


if __name__ == "__main__":
    # Get database URL from environment
    db_url = get_database_url_from_env()
    
    print("""
    ╔════════════════════════════════════════════════════════╗
    ║     CollabSphere Supabase Database Migration          ║
    ╚════════════════════════════════════════════════════════╝
    """)
    
    # Run migration
    asyncio.run(migrate_to_supabase(db_url))
    
    print("\n✨ Migration completed! You can now use your Supabase database.")
