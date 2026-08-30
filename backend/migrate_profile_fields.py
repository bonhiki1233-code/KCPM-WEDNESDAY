import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

async def migrate():
    # Load .env from backend directory
    load_dotenv("/Users/bt/Downloads/CNPM-friday/CNPM-friday4/backend/.env")
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("Error: DATABASE_URL not found in .env")
        return

    print(f"Connecting to database...")
    engine = create_async_engine(database_url)
    
    try:
        async with engine.begin() as conn:
            print("Adding 'phone' column...")
            await conn.execute(text("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)"))
            
            print("Adding 'bio' column...")
            await conn.execute(text("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT"))
            
            print("✅ Migration successful!")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
