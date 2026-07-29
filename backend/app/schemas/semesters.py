from pydantic import BaseModel, validator
from datetime import date
from typing import Optional

class SemesterBase(BaseModel):
    semester_code: str  # VD: "2026S1", "2026F1"
    semester_name: Optional[str] = None  # VD: "Học Kì 1", "Học Kì 2", "Học Kì Hè 3"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = "UPCOMING"  # ACTIVE, UPCOMING, COMPLETED

    @validator('status')
    def validate_status(cls, v):
        if v and v.upper() not in ["ACTIVE", "UPCOMING", "COMPLETED"]:
            raise ValueError('Status must be ACTIVE, UPCOMING, or COMPLETED')
        return v.upper() if v else v

class SemesterCreate(SemesterBase):
    pass

class SemesterUpdate(BaseModel):
    semester_code: Optional[str] = None
    semester_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

    @validator('status')
    def validate_status(cls, v):
        if v and v.upper() not in ["ACTIVE", "UPCOMING", "COMPLETED"]:
            raise ValueError('Status must be ACTIVE, UPCOMING, or COMPLETED')
        return v.upper() if v else v

class SemesterResponse(SemesterBase):
    semester_id: int
    
    class Config:
        from_attributes = True