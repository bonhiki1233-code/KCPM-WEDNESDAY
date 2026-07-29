"""
FastAPI router for bulk import operations (Subjects, Classes, Users).
Endpoints:
  - POST /api/v1/admin/import/subjects
  - POST /api/v1/admin/import/classes
  - POST /api/v1/admin/import/users
  - GET /api/v1/admin/import/templates/{type}
"""
from typing import Annotated, List
import json
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.api import deps
from app.models.all_models import User, ImportLog
from app.schemas.import_schemas import (
    SubjectImportResponse, ClassImportResponse, UserImportResponse
)
from app.schemas.import_log import ImportLogCreate, ImportLogResponse
from app.services import import_service

router = APIRouter(tags=["import"])


# ==========================================
# POST /subjects - Import Subjects
# ==========================================

@router.post(
    "/subjects",
    response_model=SubjectImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import subjects from CSV/Excel file"
)
async def import_subjects_endpoint(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    file: UploadFile = File(..., description="CSV or Excel file")
) -> SubjectImportResponse:
    """
    Import multiple subjects from CSV or Excel file.
    
    **Required Permissions:** ADMIN or STAFF only
    
    **File Format:**
    - CSV (.csv) or Excel (.xlsx, .xls)
    - Required columns:
        - `subject_code`: Unique subject code (e.g., IT101)
        - `subject_name`: Subject name
        - `credits`: Credit units (1-10)
        - `dept_name`: Department name (must exist in database)
    
    **Example CSV:**
    ```csv
    subject_code,subject_name,credits,dept_name
    IT101,Lập Trình Python,4,Software Engineering
    IT102,Cấu Trúc Dữ Liệu,4,Software Engineering
    ```
    
    Returns:
        SubjectImportResponse with statistics and per-row results
        
    Raises:
        HTTPException 403: User lacks permission
        HTTPException 400: Invalid file format or missing columns
    """
    # Check permission
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can import subjects"
        )
    
    # Parse file
    dataframe = await import_service.parse_import_file(file)
    
    # Import subjects
    return await import_service.import_subjects(db, dataframe)


# ==========================================
# POST /classes - Import Classes
# ==========================================

@router.post(
    "/classes",
    response_model=ClassImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import classes from CSV/Excel file"
)
async def import_classes_endpoint(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    file: UploadFile = File(..., description="CSV or Excel file")
) -> ClassImportResponse:
    """
    Import multiple classes from CSV or Excel file.
    
    **Required Permissions:** ADMIN or STAFF only
    
    **File Format:**
    - CSV (.csv) or Excel (.xlsx, .xls)
    - Required columns:
        - `class_code`: Unique class code (e.g., IT101-01)
        - `semester_code`: Semester code (must exist)
        - `subject_code`: Subject code (must exist)
        - `lecturer_email`: Lecturer's email (must be a LECTURER user)
    
    **Example CSV:**
    ```csv
    class_code,semester_code,subject_code,lecturer_email
    IT101-01,2026-SPRING,IT101,lecturer1@university.edu
    IT101-02,2026-SPRING,IT101,lecturer2@university.edu
    ```
    
    Returns:
        ClassImportResponse with statistics and per-row results
        
    Raises:
        HTTPException 403: User lacks permission
        HTTPException 400: Invalid file format or missing columns
    """
    # Check permission
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can import classes"
        )
    
    # Parse file
    dataframe = await import_service.parse_import_file(file)
    
    # Import classes
    return await import_service.import_classes(db, dataframe)


# ==========================================
# POST /users - Import Users
# ==========================================

@router.post(
    "/users",
    response_model=UserImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import users from CSV/Excel file"
)
async def import_users_endpoint(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    file: UploadFile = File(..., description="CSV or Excel file")
) -> UserImportResponse:
    """
    Import multiple user accounts from CSV or Excel file.
    
    **Required Permissions:** ADMIN or STAFF only
    
    **File Format:**
    - CSV (.csv) or Excel (.xlsx, .xls)
    - Required columns:
        - `email`: Email address (unique, must be valid)
        - `full_name`: User full name
        - `role_name`: Role (ADMIN, STAFF, HEAD_DEPT, LECTURER, STUDENT)
    - Optional columns:
        - `dept_name`: Department name (required for LECTURER, STUDENT)
        - `phone`: Phone number
    
    **Default Password:**
    - Format: `CollabSphere@{email_prefix}`
    - Example: For email `student1@uni.edu`, password is `CollabSphere@student1`
    - Users should change password on first login
    
    **Example CSV:**
    ```csv
    email,full_name,role_name,dept_name,phone
    student1@university.edu,Nguyễn Văn A,STUDENT,Software Engineering,0912345678
    lecturer1@university.edu,Trần Thị B,LECTURER,Software Engineering,0987654321
    ```
    
    Returns:
        UserImportResponse with statistics and per-row results
        
    Raises:
        HTTPException 403: User lacks permission
        HTTPException 400: Invalid file format or missing columns
    """
    # Check permission
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can import users"
        )
    
    # Parse file
    dataframe = await import_service.parse_import_file(file)
    
    # Import users
    return await import_service.import_users(db, dataframe)


# ==========================================
# GET /templates/{type} - Download Import Templates
# ==========================================

@router.get(
    "/templates/{template_type}",
    summary="Download import template"
)
async def download_template(
    template_type: str,
    current_user: Annotated[User, Depends(deps.get_current_user)]
):
    """
    Download CSV template for importing data.
    
    **Required Permissions:** ADMIN or STAFF only
    
    **Parameters:**
    - `template_type`: One of `subjects`, `classes`, `users`
    
    Returns:
        CSV file with sample data and column headers
        
    Raises:
        HTTPException 403: User lacks permission
        HTTPException 400: Invalid template type
    """
    # Check permission
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can download templates"
        )
    
    # Validate template type and get corresponding file
    template_type = template_type.lower().strip()
    template_files = {
        'subjects': 'subjects_template.csv',
        'classes': 'classes_template.csv',
        'users': 'users_template.csv'
    }
    
    if template_type not in template_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid template type. Supported: 'subjects', 'classes', 'users'"
        )
    
    # Get template file path
    template_filename = template_files[template_type]
    template_dir = Path(__file__).parent.parent.parent / "templates"
    template_path = template_dir / template_filename
    
    # Check if file exists
    if not template_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template file not found: {template_filename}"
        )
    
    # Read file and add UTF-8 BOM for Excel compatibility
    with open(template_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add BOM to ensure Vietnamese characters display correctly in Excel
    content_with_bom = '\ufeff' + content
    
    # Return file with proper headers
    return Response(
        content=content_with_bom.encode('utf-8'),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={template_type}_import_template.csv"
        }
    )


# ==========================================
# Import Log Endpoints
# ==========================================

@router.post(
    "/logs",
    response_model=ImportLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save import log"
)
async def create_import_log(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    log_data: ImportLogCreate
) -> ImportLogResponse:
    """
    Save an import log to database.
    
    **Required Permissions:** ADMIN or STAFF only
    """
    # Check permission
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can create import logs"
        )
    
    # Create log
    new_log = ImportLog(
        user_id=current_user.user_id,
        import_type=log_data.import_type,
        total_rows=log_data.total_rows,
        successful=log_data.successful,
        failed=log_data.failed,
        skipped=log_data.skipped,
        details=log_data.details,
        imported_ids=log_data.imported_ids
    )
    
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    
    return new_log


@router.get(
    "/logs",
    response_model=List[ImportLogResponse],
    summary="Get user's import logs"
)
async def get_import_logs(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)]
) -> List[ImportLogResponse]:
    """
    Get all import logs for the current user.
    
    **Required Permissions:** ADMIN or STAFF only
    """
    # Check permission
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can view import logs"
        )
    
    # Get logs for current user, ordered by newest first
    result = await db.execute(
        select(ImportLog)
        .where(ImportLog.user_id == current_user.user_id)
        .order_by(desc(ImportLog.created_at))
    )
    logs = result.scalars().all()
    
    return logs


@router.delete(
    "/logs/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete import log"
)
async def delete_import_log(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    log_id: int
):
    """
    Delete an import log.
    
    **Required Permissions:** ADMIN or STAFF (own logs only)
    """
    # Check permission
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can delete import logs"
        )
    
    # Get log
    result = await db.execute(
        select(ImportLog).where(ImportLog.log_id == log_id)
    )
    log = result.scalars().first()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import log not found"
        )
    
    # Check ownership
    if log.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own import logs"
        )
    
    await db.delete(log)
    await db.commit()

