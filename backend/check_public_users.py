import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

backend_path = "/Users/bt/Downloads/CNPM-friday/CNPM-friday4/backend"
load_dotenv(os.path.join(backend_path, ".env"))

async def check():
    url = os.getenv("DATABASE_URL")
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public'"))
        rows = result.fetchall()
        print("\nColumns in public.users:")
        for row in rows:
            print(f"- {row[0]} ({row[1]})")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
