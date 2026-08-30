from pydantic import BaseModel
from typing import Optional

# Create Schema for Department
class DepartmentCreate(BaseModel):
    dept_name: str
    dept_head_id: Optional[str] = None

# Update Schema for Department
class DepartmentUpdate(BaseModel):
    dept_name: Optional[str] = None
    dept_head_id: Optional[str] = None

# Response Schema for Department
class DepartmentResponse(BaseModel):
    dept_id: int
    dept_name: str
    dept_head_id: Optional[str]

    class Config:
        orm_mode = True
