"""
Service layer for bulk import operations (Subjects, Classes, Users).
Handles parsing and database operations for CSV/Excel imports.
"""
import pandas as pd
import io
from typing import List, Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.schemas.import_schemas import (
    SubjectImportRow, SubjectImportResultRow, SubjectImportResponse,
    ClassImportRow, ClassImportResultRow, ClassImportResponse,
    UserImportRow, UserImportResultRow, UserImportResponse,
    ImportStats
)
from app.models.all_models import Subject, AcademicClass, User, Department, Semester, Role
from passlib.context import CryptContext

# Use sha256_crypt to avoid bcrypt 72-byte limit issues
import_pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


# ==========================================
# FILE PARSING UTILITIES
# ==========================================

async def parse_import_file(file: UploadFile) -> pd.DataFrame:
    """
    Parse uploaded CSV or Excel file into DataFrame.
    Cleans column names and handles various encodings.
    """
    filename = file.filename.lower()
    content = await file.read()
    
    try:
        if filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content), dtype={col: str for col in ['phone', 'semester_code', 'dept_name', 'subject_code', 'lecturer_email']})
        elif filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content), dtype={'phone': str}, encoding='utf-8-sig')
        else:
            raise ValueError("Invalid file format. Supported formats: CSV, XLSX, XLS")
        
        if df.empty:
            raise ValueError("File is empty")
            
        # Clean column names: strip whitespace, lowercase
        df.columns = [str(c).strip().lower() for c in df.columns]
        return df
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error parsing file: {str(e)}"
        )


# ==========================================
# SUBJECT IMPORT SERVICE
# ==========================================

async def import_subjects(db: AsyncSession, dataframe: pd.DataFrame) -> SubjectImportResponse:
    """
    Import subjects from DataFrame.
    
    Expected columns: subject_code, subject_name, credits, dept_name
    """
    # Validate required columns
    required_cols = {'subject_code', 'subject_name', 'credits', 'dept_name'}
    cols_in_df = set(dataframe.columns)
    
    if not required_cols.issubset(cols_in_df):
        missing = required_cols - cols_in_df
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing)}"
        )
    
    stats = ImportStats(total_rows=len(dataframe))
    results = []
    
    # Cache departments to avoid repeated DB calls
    depts = (await db.execute(select(Department))).scalars().all()
    dept_map = {d.dept_name: d.dept_id for d in depts}
    
    # Cache existing subject codes
    existing_codes = (await db.execute(select(Subject.subject_code))).scalars().all()
    existing_codes_set = set(existing_codes)
    
    for index, row in dataframe.iterrows():
        row_num = index + 2  # Row numbers start at 2 (header is row 1)
        
        try:
            subject_code = str(row.get('subject_code', '')).strip()
            subject_name = str(row.get('subject_name', '')).strip()
            credits_str = str(row.get('credits', '')).strip()
            dept_name = str(row.get('dept_name', '')).strip()
            
            # Validate required fields
            if not subject_code:
                raise ValueError("subject_code is required")
            if not subject_name:
                raise ValueError("subject_name is required")
            if not credits_str:
                raise ValueError("credits is required")
            if not dept_name:
                raise ValueError("dept_name is required")
            
            # Validate credits
            try:
                credits = int(credits_str)
                if credits < 1 or credits > 10:
                    raise ValueError(f"credits must be between 1 and 10, got {credits}")
            except ValueError as e:
                raise ValueError(f"Invalid credits value: {str(e)}")
            
            # Check duplicate subject code
            if subject_code in existing_codes_set:
                stats.skipped += 1
                results.append(SubjectImportResultRow(
                    row_number=row_num,
                    subject_code=subject_code,
                    status="skipped",
                    message=f"Subject code '{subject_code}' already exists"
                ))
                continue
            
            # Get department ID
            dept_id = dept_map.get(dept_name)
            if not dept_id:
                raise ValueError(f"Department '{dept_name}' not found in database")
            
            # Create subject
            new_subject = Subject(
                subject_code=subject_code,
                subject_name=subject_name,
                credits=credits,
                dept_id=dept_id
            )
            db.add(new_subject)
            await db.flush()
            
            existing_codes_set.add(subject_code)
            stats.successful += 1
            results.append(SubjectImportResultRow(
                row_number=row_num,
                subject_code=subject_code,
                status="success",
                subject_id=new_subject.subject_id,
                message="Subject created successfully"
            ))
            
        except Exception as e:
            stats.failed += 1
            results.append(SubjectImportResultRow(
                row_number=row_num,
                subject_code=str(row.get('subject_code', 'N/A')),
                status="error",
                message=f"Line {row_num}: {str(e)}"
            ))
    
    await db.commit()
    
    return SubjectImportResponse(
        total_rows=stats.total_rows,
        successful=stats.successful,
        failed=stats.failed,
        skipped=stats.skipped,
        results=results
    )


# ==========================================
# CLASS IMPORT SERVICE
# ==========================================

async def import_classes(db: AsyncSession, dataframe: pd.DataFrame) -> ClassImportResponse:
    """
    Import classes from DataFrame.
    
    Expected columns: class_code, semester_code, subject_code, lecturer_email
    """
    # Validate required columns
    required_cols = {'class_code', 'semester_code', 'subject_code', 'lecturer_email'}
    cols_in_df = set(dataframe.columns)
    
    if not required_cols.issubset(cols_in_df):
        missing = required_cols - cols_in_df
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing)}"
        )
    
    stats = ImportStats(total_rows=len(dataframe))
    results = []
    
    # Cache semesters by code
    semesters = (await db.execute(select(Semester))).scalars().all()
    sem_map = {s.semester_code: s.semester_id for s in semesters}
    
    # Cache subjects by code
    subjects = (await db.execute(select(Subject))).scalars().all()
    subj_map = {s.subject_code: s.subject_id for s in subjects}
    
    # Cache users by email and role
    lecturer_role = (await db.execute(select(Role).where(Role.role_name == 'LECTURER'))).scalars().first()
    if not lecturer_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LECTURER role not found in database"
        )
    
    lecturers = (await db.execute(select(User).where(User.role_id == lecturer_role.role_id))).scalars().all()
    lecturer_map = {u.email: u.user_id for u in lecturers}
    
    # Cache existing class codes
    existing_codes = (await db.execute(select(AcademicClass.class_code))).scalars().all()
    existing_codes_set = set(existing_codes)
    
    for index, row in dataframe.iterrows():
        row_num = index + 2  # Row numbers start at 2
        
        try:
            class_code = str(row.get('class_code', '')).strip()
            semester_code = str(row.get('semester_code', '')).strip()
            subject_code = str(row.get('subject_code', '')).strip()
            lecturer_email = str(row.get('lecturer_email', '')).strip()
            
            # Validate required fields
            if not class_code:
                raise ValueError("class_code is required")
            if not semester_code:
                raise ValueError("semester_code is required")
            if not subject_code:
                raise ValueError("subject_code is required")
            if not lecturer_email:
                raise ValueError("lecturer_email is required")
            
            # Check duplicate class code
            if class_code in existing_codes_set:
                stats.skipped += 1
                results.append(ClassImportResultRow(
                    row_number=row_num,
                    class_code=class_code,
                    status="skipped",
                    message=f"Class code '{class_code}' already exists"
                ))
                continue
            
            # Get semester ID
            semester_id = sem_map.get(semester_code)
            if not semester_id:
                raise ValueError(f"Semester with code '{semester_code}' not found")
            
            # Get subject ID
            subj_id = subj_map.get(subject_code)
            if not subj_id:
                raise ValueError(f"Subject with code '{subject_code}' not found")
            
            # Get lecturer ID
            lecturer_id = lecturer_map.get(lecturer_email)
            if not lecturer_id:
                raise ValueError(f"Lecturer with email '{lecturer_email}' not found or not a lecturer")
            
            # Create class
            new_class = AcademicClass(
                class_code=class_code,
                semester_id=semester_id,
                subject_id=subj_id,
                lecturer_id=lecturer_id
            )
            db.add(new_class)
            await db.flush()
            
            existing_codes_set.add(class_code)
            stats.successful += 1
            results.append(ClassImportResultRow(
                row_number=row_num,
                class_code=class_code,
                status="success",
                class_id=new_class.class_id,
                message="Class created successfully"
            ))
            
        except Exception as e:
            stats.failed += 1
            results.append(ClassImportResultRow(
                row_number=row_num,
                class_code=str(row.get('class_code', 'N/A')),
                status="error",
                message=f"Line {row_num}: {str(e)}"
            ))
    
    await db.commit()
    
    return ClassImportResponse(
        total_rows=stats.total_rows,
        successful=stats.successful,
        failed=stats.failed,
        skipped=stats.skipped,
        results=results
    )


# ==========================================
# USER IMPORT SERVICE
# ==========================================

async def import_users(db: AsyncSession, dataframe: pd.DataFrame) -> UserImportResponse:
    """
    Import users from DataFrame.
    
    Expected columns: email, full_name, role_name, dept_name (optional), phone (optional)
    """
    # Validate required columns
    required_cols = {'email', 'full_name', 'role_name'}
    cols_in_df = set(dataframe.columns)
    
    if not required_cols.issubset(cols_in_df):
        missing = required_cols - cols_in_df
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing)}"
        )
    
    stats = ImportStats(total_rows=len(dataframe))
    results = []
    
    # Cache roles by name
    roles = (await db.execute(select(Role))).scalars().all()
    role_map = {r.role_name: r.role_id for r in roles}
    
    # Cache departments by name
    depts = (await db.execute(select(Department))).scalars().all()
    dept_map = {d.dept_name: d.dept_id for d in depts}
    
    # Cache existing emails
    existing_emails = (await db.execute(select(User.email))).scalars().all()
    existing_emails_set = set(existing_emails)
    
    for index, row in dataframe.iterrows():
        row_num = index + 2  # Row numbers start at 2
        
        try:
            email = str(row.get('email', '')).strip()
            full_name = str(row.get('full_name', '')).strip()
            role_name = str(row.get('role_name', '')).strip().upper()
            dept_name = str(row.get('dept_name', '')).strip() if 'dept_name' in cols_in_df else None
            phone = str(row.get('phone', '')).strip() if 'phone' in cols_in_df else None
            
            # Validate required fields
            if not email:
                raise ValueError("email is required")
            if not full_name:
                raise ValueError("full_name is required")
            if not role_name:
                raise ValueError("role_name is required")
            
            # Validate email format (basic check)
            if '@' not in email:
                raise ValueError("Invalid email format")
            
            # Validate role exists
            if role_name not in role_map:
                allowed = ', '.join(role_map.keys())
                raise ValueError(f"Invalid role '{role_name}'. Allowed: {allowed}")
            
            # Department required for LECTURER and STUDENT
            if role_name in ['LECTURER', 'STUDENT']:
                if not dept_name:
                    raise ValueError(f"Department is required for {role_name} role")
            
            # Check duplicate email
            if email in existing_emails_set:
                stats.skipped += 1
                results.append(UserImportResultRow(
                    row_number=row_num,
                    email=email,
                    status="skipped",
                    message="Email already exists in database"
                ))
                continue
            
            # Get role ID
            role_id = role_map.get(role_name)
            
            # Get department ID if needed
            dept_id = None
            if dept_name:
                dept_id = dept_map.get(dept_name)
                if not dept_id:
                    raise ValueError(f"Department '{dept_name}' not found in database")
            
            # Create user with default password
            username = email.split('@')[0]
            password = f"CollabSphere@{username}"
            
            new_user = User(
                email=email,
                full_name=full_name,
                password_hash=import_pwd_context.hash(password),
                role_id=role_id,
                dept_id=dept_id,
                phone=phone if phone else None,
                is_active=True
            )
            db.add(new_user)
            await db.flush()
            
            existing_emails_set.add(email)
            stats.successful += 1
            results.append(UserImportResultRow(
                row_number=row_num,
                email=email,
                status="success",
                user_id=new_user.user_id,
                message="User created successfully"
            ))
            
        except Exception as e:
            stats.failed += 1
            results.append(UserImportResultRow(
                row_number=row_num,
                email=str(row.get('email', 'N/A')),
                status="error",
                message=f"Line {row_num}: {str(e)}"
            ))
    
    await db.commit()
    
    return UserImportResponse(
        total_rows=stats.total_rows,
        successful=stats.successful,
        failed=stats.failed,
        skipped=stats.skipped,
        results=results
    )
