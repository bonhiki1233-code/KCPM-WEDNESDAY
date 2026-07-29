"""
FastAPI router for User Import from Excel/CSV.
Endpoint: POST /users/import
"""
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.all_models import User
from app.schemas.user_import import UserImportResponse
from app.services import user_import_service

router = APIRouter()


# ==========================================
# POST /users/import - Import Users from Excel/CSV
# ==========================================


@router.post(
    "/users/import",
    response_model=UserImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import users from Excel/CSV file"
)
async def import_users_from_file(
    *,
    db: Annotated[AsyncSession, Depends(deps.get_db)],
    current_user: Annotated[User, Depends(deps.get_current_user)],
    file: UploadFile = File(..., description="Excel (.xlsx, .xls) or CSV file")
) -> UserImportResponse:
    """
    Import multiple users from Excel or CSV file.
    
    **Required Permissions:** ADMIN or STAFF only
    
    **File Format:**
    - Excel (.xlsx, .xls) or CSV (.csv)
    - Required columns:
        - `email`: User email (must be unique)
        - `full_name`: Full name
        - `role_name`: One of [ADMIN, STAFF, HEAD_DEPT, LECTURER, STUDENT]
    - Optional columns:
        - `dept_name`: Department name (required for LECTURER and STUDENT)
        - `phone`: Phone number
    
    **Default Password:**
    - Format: `CollabSphere@{username}`
    - Example: `student123@university.edu` -> `CollabSphere@student123`
    - Users should change password on first login
    
    **Example Excel/CSV:**
    ```
    email                    | full_name      | role_name | dept_name              | phone
    student1@university.edu  | Nguyễn Văn A   | STUDENT   | Software Engineering   | 0912345678
    lecturer@university.edu  | Trần Thị B     | LECTURER  | Software Engineering   | 0987654321
    staff@university.edu     | Lê Văn C       | STAFF     |                        | 0901234567
    ```
    
    **Response:**
    - `total_rows`: Total number of rows processed
    - `successful`: Number of users created
    - `failed`: Number of rows with errors
    - `skipped`: Number of rows skipped (e.g., duplicate emails)
    - `results`: Detailed result for each row
    
    Args:
        file: Uploaded Excel/CSV file
        
    Returns:
        UserImportResponse: Import statistics and detailed results
        
    Raises:
        HTTPException 403: User lacks permission (not ADMIN/STAFF)
        HTTPException 400: Invalid file format or missing columns
        HTTPException 422: Invalid data in file
    """
    # Check permission: Only ADMIN or STAFF can import users
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can import users"
        )
    
    # Validate file size (max 10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    file.file.seek(0, 2)  # Move to end of file
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / 1024 / 1024}MB"
        )
    
    # Parse file
    users = await user_import_service.parse_import_file(file)
    
    # Import users
    stats, results = await user_import_service.import_users(db, users)
    
    # Return response
    return UserImportResponse(
        total_rows=stats.total_rows,
        successful=stats.successful,
        failed=stats.failed,
        skipped=stats.skipped,
        results=results
    )


# ==========================================
# GET /users/import/template - Download Import Template
# ==========================================


@router.get(
    "/users/import/template",
    summary="Download user import template"
)
async def download_import_template(
    current_user: Annotated[User, Depends(deps.get_current_user)]
):
    """
    Download Excel template for user import.
    
    **Required Permissions:** ADMIN or STAFF only
    
    Returns:
        StreamingResponse: Excel file with sample data
        
    Raises:
        HTTPException 403: User lacks permission
    """
    # Check permission
    if current_user.role.role_name not in ['ADMIN', 'STAFF']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN and STAFF can access import template"
        )
    
    # Create sample DataFrame
    import pandas as pd
    from fastapi.responses import StreamingResponse
    import io
    
    sample_data = {
        'email': [
            'student1@university.edu',
            'student2@university.edu',
            'lecturer@university.edu',
            'staff@university.edu'
        ],
        'full_name': [
            'Nguyễn Văn A',
            'Trần Thị B',
            'Lê Văn C',
            'Phạm Thị D'
        ],
        'role_name': [
            'STUDENT',
            'STUDENT',
            'LECTURER',
            'STAFF'
        ],
        'dept_name': [
            'Software Engineering',
            'Computer Science',
            'Software Engineering',
            ''
        ],
        'phone': [
            '0912345678',
            '0987654321',
            '0901234567',
            '0965432109'
        ]
    }
    
    df = pd.DataFrame(sample_data)
    
    # Create Excel file in memory
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Users')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': 'attachment; filename=user_import_template.xlsx'
        }
    )