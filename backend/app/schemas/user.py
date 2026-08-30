from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


ROLE_NAME_TO_ID = {
    "admin": 1,
    "staff": 2,
    "head_dept": 3,
    "lecturer": 4,
    "student": 5,
}

# Dữ liệu chung
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    dept_id: Optional[int] = None

# Dữ liệu cần để tạo User (Client gửi lên)
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72)
    role_id: Optional[int] = None  # 1=Admin, 5=Student (tùy quy định DB của bạn)
    role: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def map_role_aliases(cls, values):
        if isinstance(values, dict):
            if "roleId" in values and "role_id" not in values:
                values["role_id"] = values["roleId"]
        return values

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if isinstance(value, str):
            normalized = value.strip().lower().replace("-", " ")
            normalized = "_".join(normalized.split())
            return normalized
        return value

    @field_validator("role_id", mode="before")
    @classmethod
    def coerce_role_id(cls, value):
        if value is None:
            return value
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed.isdigit():
                return int(trimmed)
            normalized = trimmed.lower().replace("-", " ")
            normalized = "_".join(normalized.split())
            if normalized in ROLE_NAME_TO_ID:
                return ROLE_NAME_TO_ID[normalized]
        return value

    @model_validator(mode="after")
    def resolve_role_id(self):
        if self.role_id is None and self.role:
            normalized = self.role.strip().lower().replace("-", " ")
            normalized = "_".join(normalized.split())
            if normalized in ROLE_NAME_TO_ID:
                self.role_id = ROLE_NAME_TO_ID[normalized]
            else:
                raise ValueError(
                    "Invalid role. Use one of: admin, staff, head_dept, lecturer, student."
                )
        if self.role_id is None:
            raise ValueError("role_id is required.")
        return self

# Dữ liệu User trả về cho Client (Không được trả password!)
class UserResponse(UserBase):
    user_id: UUID
    role_id: int
    avatar_url: Optional[str] = None
    can_create_topics: Optional[bool] = None

    class Config:
        from_attributes = True  # Để đọc được dữ liệu từ SQLAlchemy model


class UserAdminResponse(UserResponse):
    role_name: Optional[str] = None


class UserTopicPermissionUpdate(BaseModel):
    can_create_topics: bool