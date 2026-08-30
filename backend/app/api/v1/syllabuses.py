from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
import logging

from app.api.deps import get_db
from app.models.all_models import Syllabus, Subject, Department
from app.schemas.syllabuses import (
    SyllabusCreate,
    SyllabusUpdate,
    SyllabusResponse,
    SyllabusWithSubject
)

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/", response_model=SyllabusResponse, status_code=201)
async def create_syllabus(
    syllabus_in: SyllabusCreate,
    db: AsyncSession = Depends(get_db)
):
    # Validate subject exists
    subject_query = select(Subject).where(Subject.subject_id == syllabus_in.subject_id)
    subject_result = await db.execute(subject_query)
    subject = subject_result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    db_syllabus = Syllabus(
        subject_id=syllabus_in.subject_id,
        description=syllabus_in.description,
        min_score_to_pass=syllabus_in.min_score_to_pass,
        effective_date=syllabus_in.effective_date,
        is_active=syllabus_in.is_active
    )
    
    db.add(db_syllabus)
    await db.commit()
    await db.refresh(db_syllabus)
    
    return db_syllabus

@router.get("/", response_model=List[SyllabusWithSubject])
async def get_all_syllabuses(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    subject_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Syllabus, Subject, Department).join(
        Subject, Syllabus.subject_id == Subject.subject_id
    ).join(
        Department, Subject.dept_id == Department.dept_id
    )
    
    if is_active is not None:
        query = query.where(Syllabus.is_active == is_active)
    if subject_id is not None:
        query = query.where(Syllabus.subject_id == subject_id)
    
    query = query.offset(skip).limit(limit).order_by(Syllabus.syllabus_id.desc())
    
    result = await db.execute(query)
    rows = result.all()
    
    syllabuses = []
    for syllabus, subject, department in rows:
        syllabus_dict = {
            "syllabus_id": syllabus.syllabus_id,
            "subject_id": syllabus.subject_id,
            "description": syllabus.description,
            "min_score_to_pass": syllabus.min_score_to_pass,
            "effective_date": syllabus.effective_date,
            "is_active": syllabus.is_active,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "department_name": department.dept_name
        }
        syllabuses.append(syllabus_dict)
    
    return syllabuses

@router.get("/{syllabus_id}", response_model=SyllabusResponse)
async def get_syllabus(
    syllabus_id: int,
    db: AsyncSession = Depends(get_db)
):
    query = select(Syllabus).where(Syllabus.syllabus_id == syllabus_id)
    result = await db.execute(query)
    syllabus = result.scalar_one_or_none()
    
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    
    return syllabus

@router.put("/{syllabus_id}", response_model=SyllabusResponse)
async def update_syllabus(
    syllabus_id: int,
    syllabus_in: SyllabusUpdate,
    db: AsyncSession = Depends(get_db)
):
    query = select(Syllabus).where(Syllabus.syllabus_id == syllabus_id)
    result = await db.execute(query)
    db_syllabus = result.scalar_one_or_none()
    
    if not db_syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    
    if syllabus_in.subject_id is not None:
        db_syllabus.subject_id = syllabus_in.subject_id
    if syllabus_in.description is not None:
        db_syllabus.description = syllabus_in.description
    if syllabus_in.min_score_to_pass is not None:
        db_syllabus.min_score_to_pass = syllabus_in.min_score_to_pass
    if syllabus_in.effective_date is not None:
        db_syllabus.effective_date = syllabus_in.effective_date
    if syllabus_in.is_active is not None:
        db_syllabus.is_active = syllabus_in.is_active
    
    await db.commit()
    await db.refresh(db_syllabus)
    
    return db_syllabus

@router.delete("/{syllabus_id}", status_code=204)
async def delete_syllabus(
    syllabus_id: int,
    db: AsyncSession = Depends(get_db)
):
    query = select(Syllabus).where(Syllabus.syllabus_id == syllabus_id)
    result = await db.execute(query)
    db_syllabus = result.scalar_one_or_none()
    
    if not db_syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    
    await db.delete(db_syllabus)
    await db.commit()
    
    return None
