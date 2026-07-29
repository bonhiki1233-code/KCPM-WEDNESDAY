"""
Quick migration script for Supabase - Execute SQL directly
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Direct Supabase connection with small pool
DATABASE_URL = "postgresql+asyncpg://postgres.csvlvzkucubqlfnuuizk:noud5fmSks8xf0g3@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

async def migrate():
    # Create engine with single connection
    engine = create_async_engine(
        DATABASE_URL,
        echo=True,
        pool_size=1,
        max_overflow=0
    )
    
    try:
        async with engine.begin() as conn:
            print("🔧 Adding title column...")
            await conn.execute(
                text("""
                    ALTER TABLE resources 
                    ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Untitled Resource' NOT NULL
                """)
            )
            
            print("🔧 Adding description column...")
            await conn.execute(
                text("""
                    ALTER TABLE resources 
                    ADD COLUMN IF NOT EXISTS description TEXT
                """)
            )
            
            print("🔧 Adding created_at column...")
            await conn.execute(
                text("""
                    ALTER TABLE resources 
                    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                """)
            )
            
            print("✅ Migration completed!")
            
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
