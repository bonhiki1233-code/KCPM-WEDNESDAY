"""Add import_logs table

This script creates the import_logs table in the database.
Run: python backend/migrate_add_import_logs.py
"""
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal


async def add_import_logs_table():
    """Add import_logs table to database."""
    async with AsyncSessionLocal() as db:
        try:
            # Create import_logs table
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS import_logs (
                    log_id SERIAL PRIMARY KEY,
                    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    import_type VARCHAR(50) NOT NULL,
                    total_rows INTEGER DEFAULT 0,
                    successful INTEGER DEFAULT 0,
                    failed INTEGER DEFAULT 0,
                    skipped INTEGER DEFAULT 0,
                    details TEXT,
                    imported_ids TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            
            # Create index on user_id for faster queries
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_import_logs_user_id 
                ON import_logs(user_id);
            """))
            
            # Create index on created_at for sorting
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_import_logs_created_at 
                ON import_logs(created_at DESC);
            """))
            
            await db.commit()
            print("✅ import_logs table created successfully!")
            print("✅ Indexes created: idx_import_logs_user_id, idx_import_logs_created_at")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Error creating table: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(add_import_logs_table())
