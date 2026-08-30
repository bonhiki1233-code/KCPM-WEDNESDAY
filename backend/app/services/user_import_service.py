import pandas as pd
import io
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Tuple

from app.schemas.user_import import UserImportRow, UserImportStats, UserImportResultRow
from app.models.all_models import User, Role, Department
from passlib.context import CryptContext

# Use sha256_crypt to avoid bcrypt 72-byte limit issues in this environment
import_pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

async def parse_import_file(file: UploadFile) -> List[UserImportRow]:
    """Parse uploaded file into list of UserImportRow objects."""
    filename = file.filename.lower()
    content = await file.read()
    
    try:
        if filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content), dtype={'phone': str})
        elif filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content), dtype={'phone': str})
        else:
            raise HTTPException(status_code=400, detail="Invalid file format")
            
        # Clean column names (strip whitespace, lowercase)
        df.columns = [str(c).strip().lower() for c in df.columns]
        
        # Validate required columns
        required_cols = {'email', 'full_name', 'role_name'}
        if not required_cols.issubset(df.columns):
            missing = required_cols - set(df.columns)
            raise ValueError(f"Missing required columns: {missing}")
            
        users = []
        for index, row in df.iterrows():
            # Replace NaN with None
            row_dict = row.where(pd.notnull(row), None).to_dict()
            
            # Create Pydantic model (performs validation)
            try:
                user = UserImportRow(**row_dict)
                users.append(user)
            except Exception as e:
                # We catch parsing errors here or let them bubble up? 
                # Better to fail fast or collect errors? 
                # For now let's fail fast to keep it simple, or maybe skip?
                # The schema says we track "failed" rows.
                raise ValueError(f"Row {index+2}: {str(e)}")
                
        return users
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

async def import_users(db: AsyncSession, users: List[UserImportRow]) -> Tuple[UserImportStats, List[UserImportResultRow]]:
    """Process import of users."""
    stats = UserImportStats(total_rows=len(users))
    results = []
    
    # Cache roles/depts to avoid repeated DB calls
    roles = (await db.execute(select(Role))).scalars().all()
    role_map = {r.role_name: r.role_id for r in roles}
    
    depts = (await db.execute(select(Department))).scalars().all()
    dept_map = {d.dept_name: d.dept_id for d in depts}
    
    for i, user_in in enumerate(users, start=1):
        result_row = UserImportResultRow(
            row_number=i,
            email=user_in.email,
            status="pending"
        )
        
        try:
            # 1. Check existing email
            stmt = select(User).where(User.email == user_in.email)
            existing = (await db.execute(stmt)).scalars().first()
            
            if existing:
                stats.skipped += 1
                result_row.status = "skipped"
                result_row.message = "Email already exists"
                results.append(result_row)
                continue
                
            # 2. Get Role ID
            role_id = role_map.get(user_in.role_name)
            if not role_id:
                # Should not happen due to validator, but safe check
                raise ValueError(f"Role {user_in.role_name} not found in DB")
                
            # 3. Get Dept ID (optional)
            dept_id = None
            if user_in.dept_name:
                dept_id = dept_map.get(user_in.dept_name)
                # If dept doesn't exist, maybe create it? Or error?
                # Let's assume error for now to enforce consistency
                if not dept_id and user_in.role_name in ['LECTURER', 'STUDENT']:
                     raise ValueError(f"Department {user_in.dept_name} not found")
            
            # 4. Create User
            # Default password: CollabSphere@{user_email_prefix}
            username = user_in.email.split('@')[0]
            password = f"CollabSphere@{username}"
            
            new_user = User(
                email=user_in.email,
                full_name=user_in.full_name,
                password_hash=import_pwd_context.hash(password),
                role_id=role_id,
                dept_id=dept_id,
                phone=user_in.phone,
                is_active=True
            )
            db.add(new_user)
            await db.flush() # to get ID
            
            stats.successful += 1
            result_row.status = "success"
            result_row.user_id = new_user.user_id
            result_row.message = "User created successfully"
            
        except Exception as e:
            stats.failed += 1
            result_row.status = "failed"
            result_row.message = str(e)
            
        results.append(result_row)
        
    await db.commit()
    return stats, results