from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.models.all_models import AcademicClass
from app.schemas.academic_classes import AcademicClassCreate, AcademicClassUpdate, AcademicClassResponse
from typing import List

router = APIRouter()

@router.post("/", response_model=AcademicClassResponse, status_code=201)
async def create_academic_class(
    academic_class_in: AcademicClassCreate, 
    db: AsyncSession = Depends(get_db)
):
    # Check duplicate class_code
    check_query = select(AcademicClass).where(AcademicClass.class_code == academic_class_in.class_code)
    result = await db.execute(check_query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Class with code '{academic_class_in.class_code}' already exists"
        )
    
    db_class = AcademicClass(
        class_code=academic_class_in.class_code,
        semester_id=academic_class_in.semester_id,
        subject_id=academic_class_in.subject_id,
        lecturer_id=academic_class_in.lecturer_id,
    )
    
    db.add(db_class)
    await db.commit()
    await db.refresh(db_class)
    
    return db_class

@router.get("/", response_model=List[AcademicClassResponse])
async def get_academic_classes(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    query = select(AcademicClass).offset(skip).limit(limit).order_by(AcademicClass.class_id)
    result = await db.execute(query)
    classes = result.scalars().all()
    return classes

@router.get("/{class_id}", response_model=AcademicClassResponse)
async def get_academic_class(class_id: int, db: AsyncSession = Depends(get_db)):
    query = select(AcademicClass).where(AcademicClass.class_id == class_id)
    result = await db.execute(query)
    academic_class = result.scalar_one_or_none()
    
    if not academic_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    return academic_class

@router.put("/{class_id}", response_model=AcademicClassResponse)
async def update_academic_class(
    class_id: int, 
    academic_class_in: AcademicClassUpdate, 
    db: AsyncSession = Depends(get_db)
):
    query = select(AcademicClass).where(AcademicClass.class_id == class_id)
    result = await db.execute(query)
    db_class = result.scalar_one_or_none()
    
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    if academic_class_in.class_code is not None:
        db_class.class_code = academic_class_in.class_code
    if academic_class_in.semester_id is not None:
        db_class.semester_id = academic_class_in.semester_id
    if academic_class_in.subject_id is not None:
        db_class.subject_id = academic_class_in.subject_id
    if academic_class_in.lecturer_id is not None:
        db_class.lecturer_id = academic_class_in.lecturer_id
    
    await db.commit()
    await db.refresh(db_class)
    
    return db_class

@router.delete("/{class_id}", status_code=204)
async def delete_academic_class(class_id: int, db: AsyncSession = Depends(get_db)):
    query = select(AcademicClass).where(AcademicClass.class_id == class_id)
    result = await db.execute(query)
    db_class = result.scalar_one_or_none()
    
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    await db.delete(db_class)
    await db.commit()
    
    return None
    
    return None