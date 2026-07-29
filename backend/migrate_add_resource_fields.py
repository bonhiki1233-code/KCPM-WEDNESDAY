"""
Migration: Add title, description, created_at fields to resources table
Run this script to update the database schema for Resources.
"""
import asyncio
import sys
from sqlalchemy import text
from app.db.session import engine
from app.core.config import settings


async def migrate_resources_table():
    """Add new fields to resources table"""
    
    print("🔧 Starting migration: Add Resource fields")
    print(f"📊 Database: {settings.DATABASE_URL.split('@')[-1]}")
    
    async with engine.begin() as conn:
        try:
            # Check if columns already exist
            check_title = await conn.execute(
                text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='resources' AND column_name='title'
                """)
            )
            title_exists = check_title.first() is not None
            
            if title_exists:
                print("⚠️  Columns already exist, skipping migration")
                return
            
            print("➕ Adding 'title' column (VARCHAR 255, NOT NULL)...")
            await conn.execute(
                text("""
                    ALTER TABLE resources 
                    ADD COLUMN title VARCHAR(255) DEFAULT 'Untitled Resource' NOT NULL
                """)
            )
            
            print("➕ Adding 'description' column (TEXT, nullable)...")
            await conn.execute(
                text("""
                    ALTER TABLE resources 
                    ADD COLUMN description TEXT
                """)
            )
            
            print("➕ Adding 'created_at' column (TIMESTAMP WITH TIME ZONE)...")
            await conn.execute(
                text("""
                    ALTER TABLE resources 
                    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                """)
            )
            
            print("🔄 Updating existing resources with default values...")
            await conn.execute(
                text("""
                    UPDATE resources 
                    SET created_at = NOW() 
                    WHERE created_at IS NULL
                """)
            )
            
            print("🔄 Making file_url and file_type NOT NULL...")
            await conn.execute(
                text("""
                    ALTER TABLE resources 
                    ALTER COLUMN file_url SET NOT NULL
                """)
            )
            await conn.execute(
                text("""
                    ALTER TABLE resources 
                    ALTER COLUMN file_type SET NOT NULL
                """)
            )
            
            print("✅ Migration completed successfully!")
            print("\n📋 Summary of changes:")
            print("   • Added 'title' column (VARCHAR 255, required)")
            print("   • Added 'description' column (TEXT, optional)")
            print("   • Added 'created_at' column (TIMESTAMP WITH TIME ZONE)")
            print("   • Updated existing records with default values")
            print("   • Made file_url and file_type required fields")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            sys.exit(1)


async def verify_migration():
    """Verify the migration was successful"""
    print("\n🔍 Verifying migration...")
    
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'resources'
                ORDER BY ordinal_position
            """)
        )
        
        print("\n📊 Resources table structure:")
        print("=" * 60)
        for row in result:
            nullable = "NULL" if row[2] == "YES" else "NOT NULL"
            print(f"   {row[0]:<20} {row[1]:<25} {nullable}")
        print("=" * 60)


async def main():
    """Main migration function"""
    try:
        await migrate_resources_table()
        await verify_migration()
        print("\n✅ Migration script completed successfully!")
        print("\n🚀 Next steps:")
        print("   1. Restart backend: docker-compose restart backend")
        print("   2. Test Resources API at http://localhost:8000/docs")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
