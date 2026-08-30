from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.api.deps import get_db
from app.models.all_models import Subject
from app.schemas.subjects import SubjectCreate, SubjectUpdate, SubjectResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Create Subject
@router.post("/", response_model=SubjectResponse, status_code=201)
async def create_subject(
    subject_in: SubjectCreate,
    db: AsyncSession = Depends(get_db)
):
    # ✅ LOG request data
    logger.info(f"Received subject creation request: {subject_in.dict()}")
    
    try:
        # Check subject_code
        check_query = select(Subject).where(Subject.subject_code == subject_in.subject_code)
        result = await db.execute(check_query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Subject with code '{subject_in.subject_code}' already exists"
            )
        
        db_subject = Subject(
            subject_code=subject_in.subject_code,
            subject_name=subject_in.subject_name,
            dept_id=subject_in.dept_id,
            credits=subject_in.credits
        )
        
        db.add(db_subject)
        await db.commit()
        await db.refresh(db_subject)
        
        logger.info(f"Created subject: {db_subject.subject_id}")
        return db_subject
        
    except Exception as e:
        logger.error(f"Error creating subject: {str(e)}")
        raise
# Get all Subjects
@router.get("/", response_model=List[SubjectResponse])
async def get_subjects(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    query = select(Subject).offset(skip).limit(limit).order_by(Subject.subject_id)
    result = await db.execute(query)
    subjects = result.scalars().all()
    return subjects

# Get a single Subject by ID
@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Subject).where(Subject.subject_id == subject_id)
    result = await db.execute(query)
    subject = result.scalar_one_or_none()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    return subject

# Update Subject
@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    subject_in: SubjectUpdate,
    db: AsyncSession = Depends(get_db)
):
    query = select(Subject).where(Subject.subject_id == subject_id)
    result = await db.execute(query)
    db_subject = result.scalar_one_or_none()
    
    if not db_subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    

    if subject_in.subject_code is not None:
        db_subject.subject_code = subject_in.subject_code
    if subject_in.subject_name is not None:
        db_subject.subject_name = subject_in.subject_name
    if subject_in.dept_id is not None:
        db_subject.dept_id = subject_in.dept_id
    if subject_in.credits is not None:
        db_subject.credits = subject_in.credits
    
    await db.commit()
    await db.refresh(db_subject)
    
    return db_subject

# Delete Subject
@router.delete("/{subject_id}", status_code=204)
async def delete_subject(subject_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Subject).where(Subject.subject_id == subject_id)
    result = await db.execute(query)
    db_subject = result.scalar_one_or_none()

    if not db_subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    await db.delete(db_subject)
    await db.commit()
    
    return None
