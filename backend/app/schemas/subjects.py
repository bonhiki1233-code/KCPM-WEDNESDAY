from pydantic import BaseModel
from typing import Optional

class SubjectCreate(BaseModel):
    subject_code: str
    subject_name: Optional[str] = None
    dept_id: int
    credits: Optional[int] = None  # ✅ PHẢI CÓ dòng này
class SubjectUpdate(BaseModel):
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    dept_id: Optional[int] = None
    credits: Optional[int] = None  # ✅ PHẢI CÓ dòng này

class SubjectResponse(BaseModel):
    subject_id: int
    subject_code: str
    subject_name: Optional[str] = None
    dept_id: int
    credits: Optional[int] = None  # ✅ PHẢI CÓ dòng này   
    
    class Config:
        from_attributes = True