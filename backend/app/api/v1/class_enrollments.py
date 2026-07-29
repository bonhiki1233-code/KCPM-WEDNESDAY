from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from typing import List
from uuid import UUID
import logging

from app.api.deps import get_db
from app.models.all_models import ClassEnrollment, AcademicClass, User
from app.schemas.class_enrollments import (
    ClassEnrollmentCreate,
    BulkEnrollmentCreate,
    ClassEnrollmentUpdate,
    ClassEnrollmentResponse,
    BulkEnrollmentResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ==========================================
# BULK ENROLLMENT - Gán nhiều sinh viên
# ==========================================

@router.post("/bulk", response_model=BulkEnrollmentResponse, status_code=201)
async def bulk_enroll_students(
    enrollment_data: BulkEnrollmentCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Gán nhiều sinh viên vào 1 lớp học.
    
    Example request:
    {
        "class_id": 1,
        "student_ids": [
            "uuid-1",
            "uuid-2",
            "uuid-3"
        ]
    }
    """
    logger.info(f"Bulk enrollment for class {enrollment_data.class_id}: {len(enrollment_data.student_ids)} students")
    
    # 1. Kiểm tra class có tồn tại không
    class_query = select(AcademicClass).where(AcademicClass.class_id == enrollment_data.class_id)
    class_result = await db.execute(class_query)
    academic_class = class_result.scalar_one_or_none()
    
    if not academic_class:
        raise HTTPException(
            status_code=404,
            detail=f"Class with ID {enrollment_data.class_id} not found"
        )
    
    success_enrollments = []
    errors = []
    
    # 2. Gán từng sinh viên
    for student_id in enrollment_data.student_ids:
        try:
            # Kiểm tra sinh viên có tồn tại không
            user_query = select(User).where(User.user_id == student_id)
            user_result = await db.execute(user_query)
            user = user_result.scalar_one_or_none()
            
            if not user:
                errors.append({
                    "student_id": str(student_id),
                    "error": "Student not found"
                })
                continue
            
            # Kiểm tra đã enrollment chưa
            existing_query = select(ClassEnrollment).where(
                and_(
                    ClassEnrollment.class_id == enrollment_data.class_id,
                    ClassEnrollment.student_id == student_id
                )
            )
            existing_result = await db.execute(existing_query)
            existing = existing_result.scalar_one_or_none()
            
            if existing:
                errors.append({
                    "student_id": str(student_id),
                    "error": "Already enrolled in this class"
                })
                continue
            
            # Tạo enrollment mới
            new_enrollment = ClassEnrollment(
                class_id=enrollment_data.class_id,
                student_id=student_id,
                status="active"
            )
            
            db.add(new_enrollment)
            await db.flush()  # Flush để lấy ID nhưng chưa commit
            await db.refresh(new_enrollment)
            
            success_enrollments.append(new_enrollment)
            
        except Exception as e:
            logger.error(f"Error enrolling student {student_id}: {str(e)}")
            errors.append({
                "student_id": str(student_id),
                "error": str(e)
            })
    
    # 3. Commit tất cả enrollments thành công
    if success_enrollments:
        await db.commit()
        # Refresh lại để lấy enrolled_at
        for enrollment in success_enrollments:
            await db.refresh(enrollment)
    
    return BulkEnrollmentResponse(
        success_count=len(success_enrollments),
        failed_count=len(errors),
        enrollments=success_enrollments,
        errors=errors
    )

# ==========================================
# SINGLE ENROLLMENT
# ==========================================

@router.post("/", response_model=ClassEnrollmentResponse, status_code=201)
async def enroll_student(
    enrollment: ClassEnrollmentCreate,
    db: AsyncSession = Depends(get_db)
):
    """Gán 1 sinh viên vào lớp"""
    
    # Kiểm tra class tồn tại
    class_query = select(AcademicClass).where(AcademicClass.class_id == enrollment.class_id)
    class_result = await db.execute(class_query)
    if not class_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Kiểm tra student tồn tại
    student_query = select(User).where(User.user_id == enrollment.student_id)
    student_result = await db.execute(student_query)
    if not student_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Kiểm tra duplicate
    check_query = select(ClassEnrollment).where(
        and_(
            ClassEnrollment.class_id == enrollment.class_id,
            ClassEnrollment.student_id == enrollment.student_id
        )
    )
    result = await db.execute(check_query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Student already enrolled in this class"
        )
    
    db_enrollment = ClassEnrollment(
        class_id=enrollment.class_id,
        student_id=enrollment.student_id,
        status="active"
    )
    
    db.add(db_enrollment)
    await db.commit()
    await db.refresh(db_enrollment)
    
    return db_enrollment

# ==========================================
# GET ENROLLMENTS
# ==========================================

@router.get("/class/{class_id}", response_model=List[ClassEnrollmentResponse])
async def get_class_enrollments(
    class_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Lấy danh sách sinh viên đã ghi danh vào lớp"""
    
    query = select(ClassEnrollment).where(ClassEnrollment.class_id == class_id)
    result = await db.execute(query)
    enrollments = result.scalars().all()
    
    return enrollments

@router.get("/student/{student_id}", response_model=List[ClassEnrollmentResponse])
async def get_student_enrollments(
    student_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Lấy danh sách lớp mà sinh viên đã ghi danh"""
    
    query = select(ClassEnrollment).where(ClassEnrollment.student_id == student_id)
    result = await db.execute(query)
    enrollments = result.scalars().all()
    
    return enrollments

# ==========================================
# UPDATE & DELETE
# ==========================================

@router.put("/{enrollment_id}", response_model=ClassEnrollmentResponse)
async def update_enrollment(
    enrollment_id: int,
    enrollment_update: ClassEnrollmentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Cập nhật trạng thái enrollment (active, dropped, completed)"""
    
    query = select(ClassEnrollment).where(ClassEnrollment.enrollment_id == enrollment_id)
    result = await db.execute(query)
    db_enrollment = result.scalar_one_or_none()
    
    if not db_enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    if enrollment_update.status is not None:
        db_enrollment.status = enrollment_update.status
    
    await db.commit()
    await db.refresh(db_enrollment)
    
    return db_enrollment

@router.delete("/{enrollment_id}", status_code=204)
async def delete_enrollment(
    enrollment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Xóa enrollment (rút khỏi lớp)"""
    
    query = select(ClassEnrollment).where(ClassEnrollment.enrollment_id == enrollment_id)
    result = await db.execute(query)
    db_enrollment = result.scalar_one_or_none()
    
    if not db_enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    await db.delete(db_enrollment)
    await db.commit()
    
    return None