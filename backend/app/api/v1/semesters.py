from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.api.deps import get_db, get_current_user
from app.models.all_models import Semester, User
from app.schemas.semesters import SemesterCreate, SemesterUpdate, SemesterResponse

router = APIRouter()

# --- Helpers ---
def check_admin_or_staff(user: User):
    """
    Ensure the user has Admin or Staff role.
    Role IDs: 1=Admin, 2=Staff (based on seed_roles.py)
    """
    if user.role_id not in [1, 2]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only Admin and Staff can manage semesters."
        )

async def deactivate_other_semesters(db: AsyncSession, current_semester_id: int = None):
    """
    If a semester is set to ACTIVE, set all other ACTIVE semesters to COMPLETED.
    """
    query = select(Semester).where(Semester.status == "ACTIVE")
    if current_semester_id:
        query = query.where(Semester.semester_id != current_semester_id)
    
    result = await db.execute(query)
    active_semesters = result.scalars().all()
    
    for sem in active_semesters:
        sem.status = "COMPLETED"
        db.add(sem) # Flag for update

# --- Endpoints ---

@router.get("/", response_model=List[SemesterResponse])
async def list_semesters(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all semesters.
    Accessible by all authenticated users.
    """
    result = await db.execute(select(Semester).order_by(Semester.start_date.desc()))
    return result.scalars().all()

@router.get("/current", response_model=SemesterResponse)
async def get_current_semester(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the currently ACTIVE semester.
    Accessible by all authenticated users.
    """
    result = await db.execute(select(Semester).where(Semester.status == "ACTIVE"))
    semester = result.scalars().first()
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active semester found."
        )
    return semester

@router.get("/{semester_id}", response_model=SemesterResponse)
async def get_semester_details(
    semester_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information of a specific semester.
    """
    result = await db.execute(select(Semester).where(Semester.semester_id == semester_id))
    semester = result.scalars().first()
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester not found"
        )
    return semester

@router.post("/", response_model=SemesterResponse, status_code=status.HTTP_201_CREATED)
async def create_semester(
    semester_in: SemesterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new semester.
    Only Admin/Staff.
    Example names: "Học Kì 1", "Học Kì 2", "Học Kì Hè 3"
    """
    check_admin_or_staff(current_user)

    # Check duplicate code
    check_query = select(Semester).where(Semester.semester_code == semester_in.semester_code)
    result = await db.execute(check_query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Semester with code '{semester_in.semester_code}' already exists"
        )
    
    # Logic: start_date must be before end_date
    if semester_in.start_date >= semester_in.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before end date"
        )

    # If status is ACTIVE, deactivate others
    if semester_in.status == "ACTIVE":
        await deactivate_other_semesters(db)
    
    db_semester = Semester(
        semester_code=semester_in.semester_code,
        semester_name=semester_in.semester_name,
        start_date=semester_in.start_date,
        end_date=semester_in.end_date,
        status=semester_in.status
    )
    
    db.add(db_semester)
    await db.commit()
    await db.refresh(db_semester)
    return db_semester

@router.put("/{semester_id}", response_model=SemesterResponse)
async def update_semester(
    semester_id: int,
    semester_in: SemesterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a semester.
    Only Admin/Staff.
    """
    check_admin_or_staff(current_user)
    
    result = await db.execute(select(Semester).where(Semester.semester_id == semester_id))
    db_semester = result.scalars().first()
    
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Update fields if provided
    if semester_in.semester_code:
        # Check duplicate if changing code
        if semester_in.semester_code != db_semester.semester_code:
            check_dup = await db.execute(select(Semester).where(Semester.semester_code == semester_in.semester_code))
            if check_dup.scalar_one_or_none():
                raise HTTPException(status_code=409, detail=f"Semester code '{semester_in.semester_code}' already exists")
        db_semester.semester_code = semester_in.semester_code
        
    if semester_in.semester_name:
        db_semester.semester_name = semester_in.semester_name
        
    if semester_in.start_date:
        db_semester.start_date = semester_in.start_date
    
    if semester_in.end_date:
        db_semester.end_date = semester_in.end_date
        
    # Validate dates again if either changed
    start = semester_in.start_date or db_semester.start_date
    end = semester_in.end_date or db_semester.end_date
    if start and end and start >= end:
        raise HTTPException(
            status_code=400,
            detail="Start date must be before end date"
        )

    # Handle active status logic
    if semester_in.status:
        if semester_in.status == "ACTIVE" and db_semester.status != "ACTIVE":
            await deactivate_other_semesters(db, current_semester_id=semester_id)
        db_semester.status = semester_in.status

    await db.commit()
    await db.refresh(db_semester)
    return db_semester

@router.delete("/{semester_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_semester(
    semester_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a semester.
    Only Admin/Staff.
    """
    check_admin_or_staff(current_user)
    
    result = await db.execute(select(Semester).where(Semester.semester_id == semester_id))
    db_semester = result.scalars().first()
    
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
        
    await db.delete(db_semester)
    await db.commit()