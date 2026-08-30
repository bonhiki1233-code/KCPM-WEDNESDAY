"""
Quick script to seed roles into the database.
"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://collabsphere:collabsphere_password@db:5432/collabsphere_db"

async def seed_roles():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        # Insert roles
        await conn.execute(text("""
            INSERT INTO roles (role_id, role_name) VALUES 
            (1, 'Admin'),
            (2, 'Staff'),
            (3, 'Head_Dept'),
            (4, 'Lecturer'),
            (5, 'Student')
            ON CONFLICT (role_id) DO NOTHING
        """))
        print('Roles seeded successfully!')
        
        # Verify
        result = await conn.execute(text('SELECT * FROM roles ORDER BY role_id'))
        rows = result.fetchall()
        for row in rows:
            print(f"  Role {row[0]}: {row[1]}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_roles())
