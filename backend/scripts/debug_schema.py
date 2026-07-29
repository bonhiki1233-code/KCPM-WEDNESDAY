import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        try:
            # Query column names from information_schema
            result = await db.execute(text(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'semesters'"
            ))
            columns = result.fetchall()
            print("\n--- Columns in 'semesters' ---")
            for col in columns:
                print(f"- {col[0]} ({col[1]})")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
