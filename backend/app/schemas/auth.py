"""Pydantic schemas for authentication endpoints."""

from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    mobile: str = Field(..., description="10-digit Indian mobile number")
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str
    college: str | None = None
    degree: str | None = None
    branch: str | None = None
    year_of_study: int | None = Field(None, ge=1, le=6)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        v = re.sub(r"[\s\-\(\)\+]", "", v.strip())
        if v.startswith("91") and len(v) == 12:
            v = v[2:]
        if not re.match(r"^[6-9]\d{9}$", v):
            raise ValueError("Enter a valid 10-digit Indian mobile number.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]", v):
            raise ValueError("Password must contain at least one special character.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v

    model_config = {"str_strip_whitespace": True}


class RegisterResponse(BaseModel):
    message: str
    user_id: str
    email: str
    demo_otp: str | None = None
    email_sent: bool = True
    expires_in_seconds: int = 600


class VerifyOTPRequest(BaseModel):
    user_id: str
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    purpose: str  # "registration", "login", "password_reset"


class VerifyOTPResponse(BaseModel):
    message: str
    access_token: str | None = None
    token_type: str = "bearer"
    user: dict | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    model_config = {"str_strip_whitespace": True}


class LoginResponse(BaseModel):
    message: str
    user_id: str
    email: str
    requires_otp: bool = True
    is_registration_verification: bool = False
    demo_otp: str | None = None
    email_sent: bool = True
    expires_in_seconds: int = 600



class ResendOTPRequest(BaseModel):
    user_id: str
    purpose: str


class ResendOTPResponse(BaseModel):
    message: str
    demo_otp: str | None = None
    email_sent: bool = True
    expires_in_seconds: int = 600


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    model_config = {"str_strip_whitespace": True}


class ForgotPasswordResponse(BaseModel):
    message: str
    user_id: str
    demo_otp: str | None = None
    email_sent: bool = True
    expires_in_seconds: int = 600


class ResetPasswordRequest(BaseModel):
    user_id: str
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]", v):
            raise ValueError("Password must contain at least one special character.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v


class TokenData(BaseModel):
    user_id: str | None = None
