#!/usr/bin/env python3
"""
Script to add credits column to subjects table if it doesn't exist.
Run: python migrate_add_credits.py
"""
import asyncio
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool
from app.core.config import settings

async def migrate():
    # Create async engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=True,
        poolclass=NullPool
    )
    
    async with engine.begin() as conn:
        # Check if credits column exists
        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name='subjects' AND column_name='credits'")
        )
        column_exists = result.fetchone() is not None
        
        if not column_exists:
            print("✅ Adding credits column to subjects table...")
            await conn.execute(
                text("ALTER TABLE subjects ADD COLUMN credits INTEGER")
            )
            print("✅ Migration completed!")
        else:
            print("ℹ️ Credits column already exists")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
