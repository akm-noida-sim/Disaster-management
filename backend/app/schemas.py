"""Request and response models used by the API."""

from datetime import datetime

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class StudentResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str = "student"


class AuthResponse(StudentResponse):
    access_token: str
    token_type: str = "bearer"


class DrillResultCreate(BaseModel):
    student_id: str = Field(default="demo-student", max_length=80)
    scenario: str = Field(default="Fire in Room 103", max_length=120)
    evacuation_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    score: int = Field(ge=0, le=100)
    mistakes: int = Field(ge=0)


class DrillResultResponse(DrillResultCreate):
    id: int
    created_at: datetime
