"""
Seed script for CollabSphere database.
Creates initial test data with realistic values using Faker.

Run with:
    python initial_data.py
"""
import asyncio
import sys
import os
from datetime import datetime, date, timedelta
from uuid import uuid4
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from passlib.context import CryptContext

# Import your models
from app.models.all_models import (
    Role,
    Department,
    User,
    Semester,
    Subject,
    AcademicClass,
    ClassEnrollment,
)
from app.db.base import Base

# ==========================================
# CONFIGURATION
# ==========================================

# Update with your actual database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/collabsphere_db")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Faker instance
fake = Faker()

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


async def clear_database(session: AsyncSession):
    """Clear all existing data (optional - use with caution!)"""
    print("⚠️  Clearing existing data...")
    
    # Delete in reverse order of dependencies
    await session.execute(text("DELETE FROM class_enrollments"))
    await session.execute(text("DELETE FROM academic_classes"))
    await session.execute(text("DELETE FROM subjects"))
    await session.execute(text("DELETE FROM semesters"))
    await session.execute(text("DELETE FROM users"))
    await session.execute(text("DELETE FROM departments"))
    await session.execute(text("DELETE FROM roles"))
    
    await session.commit()
    print("✅ Database cleared")


# ==========================================
# SEED FUNCTIONS
# ==========================================

async def seed_roles(session: AsyncSession):
    """Create basic roles."""
    print("\n📋 Seeding Roles...")
    
    roles_data = [
        {"role_id": 1, "role_name": "Admin"},
        {"role_id": 2, "role_name": "Staff"},
        {"role_id": 3, "role_name": "Head_Dept"},
        {"role_id": 4, "role_name": "Lecturer"},
        {"role_id": 5, "role_name": "Student"},
    ]
    
    roles = []
    for role_data in roles_data:
        role = Role(**role_data)
        roles.append(role)
        session.add(role)
    
    await session.commit()
    print(f"✅ Created {len(roles)} roles")
    return roles


async def seed_departments(session: AsyncSession):
    """Create 2 departments."""
    print("\n🏛️  Seeding Departments...")
    
    departments_data = [
        {"dept_id": 1, "dept_name": "Computer Science"},
        {"dept_id": 2, "dept_name": "Software Engineering"},
    ]
    
    departments = []
    for dept_data in departments_data:
        dept = Department(**dept_data)
        departments.append(dept)
        session.add(dept)
    
    await session.commit()
    print(f"✅ Created {len(departments)} departments")
    return departments


async def seed_admin(session: AsyncSession):
    """Create 1 admin account."""
    print("\n👤 Seeding Admin...")
    
    admin = User(
        email="admin@collabsphere.com",
        password_hash=hash_password("123"),
        full_name="System Administrator",
        role_id=1,  # Admin
        dept_id=None,
        is_active=True,
        avatar_url=fake.image_url()
    )
    
    session.add(admin)
    await session.commit()
    await session.refresh(admin)
    
    print(f"✅ Created admin: {admin.email}")
    return admin


async def seed_lecturers(session: AsyncSession, departments):
    """Create 5 lecturers."""
    print("\n👨‍🏫 Seeding Lecturers...")
    
    lecturers = []
    for i in range(5):
        lecturer = User(
            email=f"lecturer{i+1}@collabsphere.com",
            password_hash=hash_password("123"),
            full_name=fake.name(),
            role_id=4,  # Lecturer
            dept_id=departments[i % 2].dept_id,  # Alternate between departments
            is_active=True,
            avatar_url=fake.image_url()
        )
        lecturers.append(lecturer)
        session.add(lecturer)
    
    await session.commit()
    
    # Refresh to get UUIDs
    for lecturer in lecturers:
        await session.refresh(lecturer)
    
    print(f"✅ Created {len(lecturers)} lecturers")
    return lecturers


async def seed_students(session: AsyncSession, departments):
    """Create 20 students."""
    print("\n👨‍🎓 Seeding Students...")
    
    students = []
    for i in range(20):
        student = User(
            email=f"student{i+1}@collabsphere.com",
            password_hash=hash_password("123"),
            full_name=fake.name(),
            role_id=5,  # Student
            dept_id=departments[i % 2].dept_id,  # Alternate between departments
            is_active=True,
            avatar_url=fake.image_url()
        )
        students.append(student)
        session.add(student)
    
    await session.commit()
    
    # Refresh to get UUIDs
    for student in students:
        await session.refresh(student)
    
    print(f"✅ Created {len(students)} students")
    return students


async def seed_semesters(session: AsyncSession):
    """Create semesters."""
    print("\n📅 Seeding Semesters...")
    
    current_year = datetime.now().year
    
    semesters_data = [
        {
            "semester_code": f"{current_year}S1",
            "start_date": date(current_year, 1, 15),
            "end_date": date(current_year, 5, 31),
            "status": "completed"
        },
        {
            "semester_code": f"{current_year}S2",
            "start_date": date(current_year, 8, 15),
            "end_date": date(current_year, 12, 20),
            "status": "active"
        },
        {
            "semester_code": f"{current_year + 1}S1",
            "start_date": date(current_year + 1, 1, 15),
            "end_date": date(current_year + 1, 5, 31),
            "status": "upcoming"
        },
    ]
    
    semesters = []
    for sem_data in semesters_data:
        semester = Semester(**sem_data)
        semesters.append(semester)
        session.add(semester)
    
    await session.commit()
    
    # Refresh to get IDs
    for semester in semesters:
        await session.refresh(semester)
    
    print(f"✅ Created {len(semesters)} semesters")
    return semesters


async def seed_subjects(session: AsyncSession, departments):
    """Create subjects for each department."""
    print("\n📚 Seeding Subjects...")
    
    subjects_data = [
        # Computer Science subjects
        {
            "subject_code": "CS101",
            "subject_name": "Introduction to Programming",
            "dept_id": departments[0].dept_id
        },
        {
            "subject_code": "CS201",
            "subject_name": "Data Structures and Algorithms",
            "dept_id": departments[0].dept_id
        },
        {
            "subject_code": "CS301",
            "subject_name": "Database Systems",
            "dept_id": departments[0].dept_id
        },
        # Software Engineering subjects
        {
            "subject_code": "SE101",
            "subject_name": "Software Engineering Fundamentals",
            "dept_id": departments[1].dept_id
        },
        {
            "subject_code": "SE201",
            "subject_name": "Agile Project Management",
            "dept_id": departments[1].dept_id
        },
        {
            "subject_code": "SE301",
            "subject_name": "Software Architecture",
            "dept_id": departments[1].dept_id
        },
    ]
    
    subjects = []
    for subj_data in subjects_data:
        subject = Subject(**subj_data)
        subjects.append(subject)
        session.add(subject)
    
    await session.commit()
    
    # Refresh to get IDs
    for subject in subjects:
        await session.refresh(subject)
    
    print(f"✅ Created {len(subjects)} subjects")
    return subjects


async def seed_academic_classes(session: AsyncSession, semesters, subjects, lecturers):
    """Create 2 academic classes."""
    print("\n🏫 Seeding Academic Classes...")
    
    # Use the active semester
    active_semester = [s for s in semesters if s.status == "active"][0]
    
    classes_data = [
        {
            "class_code": f"CS101-{active_semester.semester_code}",
            "semester_id": active_semester.semester_id,
            "subject_id": subjects[0].subject_id,  # CS101
            "lecturer_id": lecturers[0].user_id
        },
        {
            "class_code": f"SE201-{active_semester.semester_code}",
            "semester_id": active_semester.semester_id,
            "subject_id": subjects[4].subject_id,  # SE201
            "lecturer_id": lecturers[1].user_id
        },
    ]
    
    classes = []
    for class_data in classes_data:
        academic_class = AcademicClass(**class_data)
        classes.append(academic_class)
        session.add(academic_class)
    
    await session.commit()
    
    # Refresh to get IDs
    for academic_class in classes:
        await session.refresh(academic_class)
    
    print(f"✅ Created {len(classes)} academic classes")
    return classes


async def seed_class_enrollments(session: AsyncSession, classes, students):
    """Enroll students into classes."""
    print("\n📝 Seeding Class Enrollments...")
    
    enrollments = []
    
    # Enroll first 10 students in class 1
    for i in range(10):
        enrollment = ClassEnrollment(
            class_id=classes[0].class_id,
            student_id=students[i].user_id
        )
        enrollments.append(enrollment)
        session.add(enrollment)
    
    # Enroll last 10 students in class 2
    for i in range(10, 20):
        enrollment = ClassEnrollment(
            class_id=classes[1].class_id,
            student_id=students[i].user_id
        )
        enrollments.append(enrollment)
        session.add(enrollment)
    
    await session.commit()
    
    print(f"✅ Created {len(enrollments)} enrollments")
    print(f"   - Class 1: 10 students")
    print(f"   - Class 2: 10 students")
    return enrollments


# ==========================================
# MAIN SEED FUNCTION
# ==========================================

async def seed_all(clear_first: bool = False):
    """Main function to seed all data."""
    print("\n" + "="*50)
    print("🌱 COLLABSPHERE DATABASE SEEDING")
    print("="*50)
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    # Create async session
    async_session = sessionmaker(
        engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    async with async_session() as session:
        try:
            # Optional: Clear existing data
            if clear_first:
                await clear_database(session)
            
            # Seed data in order
            roles = await seed_roles(session)
            departments = await seed_departments(session)
            admin = await seed_admin(session)
            lecturers = await seed_lecturers(session, departments)
            students = await seed_students(session, departments)
            semesters = await seed_semesters(session)
            subjects = await seed_subjects(session, departments)
            classes = await seed_academic_classes(session, semesters, subjects, lecturers)
            enrollments = await seed_class_enrollments(session, classes, students)
            
            print("\n" + "="*50)
            print("✅ SEEDING COMPLETED SUCCESSFULLY!")
            print("="*50)
            print("\n📊 Summary:")
            print(f"   - Roles: {len(roles)}")
            print(f"   - Departments: {len(departments)}")
            print(f"   - Admin: 1")
            print(f"   - Lecturers: {len(lecturers)}")
            print(f"   - Students: {len(students)}")
            print(f"   - Semesters: {len(semesters)}")
            print(f"   - Subjects: {len(subjects)}")
            print(f"   - Classes: {len(classes)}")
            print(f"   - Enrollments: {len(enrollments)}")
            print("\n🔐 Login Credentials:")
            print(f"   Admin: admin@collabsphere.com / 123")
            print(f"   Lecturer: lecturer1@collabsphere.com / 123")
            print(f"   Student: student1@collabsphere.com / 123")
            print("="*50 + "\n")
            
        except Exception as e:
            print(f"\n❌ Error during seeding: {str(e)}")
            raise
        finally:
            await engine.dispose()


# ==========================================
# CLI ENTRY POINT
# ==========================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed CollabSphere database")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing data before seeding"
    )
    
    args = parser.parse_args()
    
    # Run the async seed function
    asyncio.run(seed_all(clear_first=args.clear))