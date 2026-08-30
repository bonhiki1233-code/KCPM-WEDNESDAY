"""
Insert test users directly into database
"""
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.all_models import User, Role, Department
from app.core.security import get_password_hash

async def insert_test_users():
    async with AsyncSessionLocal() as db:
        # Hash passwords
        passwords = {
            "admin123": get_password_hash("admin123"),
            "staff123": get_password_hash("staff123"),
            "head123": get_password_hash("head123"),
            "lecturer123": get_password_hash("lecturer123"),
            "student123": get_password_hash("student123"),
        }
        
        test_users = [
            {
                "email": "admin@collabsphere.com",
                "password_hash": passwords["admin123"],
                "full_name": "Admin User",
                "role_id": 1,
                "dept_id": 1,
                "is_active": True
            },
            {
                "email": "staff@collabsphere.com",
                "password_hash": passwords["staff123"],
                "full_name": "Staff User",
                "role_id": 2,
                "dept_id": 1,
                "is_active": True
            },
            {
                "email": "head_dept@collabsphere.com",
                "password_hash": passwords["head123"],
                "full_name": "Head of Dept",
                "role_id": 3,
                "dept_id": 1,
                "is_active": True
            },
            {
                "email": "lecturer@collabsphere.com",
                "password_hash": passwords["lecturer123"],
                "full_name": "Lecturer User",
                "role_id": 4,
                "dept_id": 1,
                "is_active": True
            },
            {
                "email": "student1@collabsphere.com",
                "password_hash": passwords["student123"],
                "full_name": "Student One",
                "role_id": 5,
                "dept_id": 1,
                "is_active": True
            },
            {
                "email": "student2@collabsphere.com",
                "password_hash": passwords["student123"],
                "full_name": "Student Two",
                "role_id": 5,
                "dept_id": 1,
                "is_active": True
            }
        ]
        
        for user_data in test_users:
            # Check if user exists
            from sqlalchemy import select
            stmt = select(User).where(User.email == user_data["email"])
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"User {user_data['email']} already exists, updating...")
                for key, value in user_data.items():
                    setattr(existing, key, value)
            else:
                print(f"Creating user {user_data['email']}...")
                user = User(**user_data)
                db.add(user)
        
        await db.commit()
        print("Test users created/updated successfully!")

if __name__ == "__main__":
    asyncio.run(insert_test_users())
