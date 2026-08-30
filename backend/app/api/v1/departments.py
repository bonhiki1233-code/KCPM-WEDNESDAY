from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.api.deps import get_db
from app.models.all_models import Department, User
from app.schemas.departments import DepartmentCreate, DepartmentUpdate, DepartmentResponse

router = APIRouter()

# Create Department
@router.post("/", response_model=DepartmentResponse, status_code=201)
async def create_department(
    dept_in: DepartmentCreate,
    db: AsyncSession = Depends(get_db)
):
    check_query = select(Department).where(Department.dept_name == dept_in.dept_name)
    result = await db.execute(check_query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Department '{dept_in.dept_name}' already exists"
        )
    
    db_dept = Department(
        dept_name=dept_in.dept_name,
        dept_head_id=dept_in.dept_head_id
    )
    
    db.add(db_dept)
    await db.commit()
    await db.refresh(db_dept)
    
    return db_dept

# Get all Departments
@router.get("/", response_model=List[DepartmentResponse])
async def get_departments(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    query = select(Department).offset(skip).limit(limit).order_by(Department.dept_id)
    result = await db.execute(query)
    departments = result.scalars().all()
    return departments

# Get a single Department by ID
@router.get("/{dept_id}", response_model=DepartmentResponse)
async def get_department(dept_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Department).where(Department.dept_id == dept_id)
    result = await db.execute(query)
    department = result.scalar_one_or_none()
    
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    return department

# Update Department
@router.put("/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: int,
    dept_in: DepartmentUpdate,
    db: AsyncSession = Depends(get_db)
):
    query = select(Department).where(Department.dept_id == dept_id)
    result = await db.execute(query)
    db_dept = result.scalar_one_or_none()

    if not db_dept:
        raise HTTPException(status_code=404, detail="Department not found")

    if dept_in.dept_name:
        db_dept.dept_name = dept_in.dept_name
    if dept_in.dept_head_id:
        db_dept.dept_head_id = dept_in.dept_head_id

    await db.commit()
    await db.refresh(db_dept)
    
    return db_dept

# Delete Department
@router.delete("/{dept_id}", status_code=204)
async def delete_department(dept_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Department).where(Department.dept_id == dept_id)
    result = await db.execute(query)
    db_dept = result.scalar_one_or_none()

    if not db_dept:
        raise HTTPException(status_code=404, detail="Department not found")

    await db.delete(db_dept)
    await db.commit()
    
    return None
