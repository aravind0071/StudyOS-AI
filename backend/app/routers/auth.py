"""Auth router — all authentication endpoints."""

from datetime import timedelta, datetime, timezone
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.models.models import User, Profile, OTPPurpose, Notification, UserNotificationSettings
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    VerifyOTPRequest,
    VerifyOTPResponse,
    LoginRequest,
    LoginResponse,
    ResendOTPRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
)
from app.services.otp_service import create_and_send_otp, verify_otp
from app.services.email_service import send_login_notification_email, is_smtp_configured

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


def parse_user_agent(ua_string: str) -> tuple[str, str]:
    """Extract (device, browser) safely from User-Agent string."""
    if not ua_string:
        return "Unknown Device", "Web Browser"

    browser = "Web Browser"
    if "Edg/" in ua_string or "Edge/" in ua_string:
        browser = "Microsoft Edge"
    elif "Chrome/" in ua_string and "Safari/" in ua_string:
        browser = "Google Chrome"
    elif "Firefox/" in ua_string:
        browser = "Mozilla Firefox"
    elif "Safari/" in ua_string and "Chrome" not in ua_string:
        browser = "Apple Safari"
    elif "Opera/" in ua_string or "OPR/" in ua_string:
        browser = "Opera"

    device = "Unknown Device"
    if "Windows NT 10.0" in ua_string:
        device = "Windows 10/11 PC"
    elif "Windows" in ua_string:
        device = "Windows PC"
    elif "Macintosh" in ua_string or "Mac OS X" in ua_string:
        device = "Macintosh (macOS)"
    elif "iPhone" in ua_string:
        device = "Apple iPhone"
    elif "iPad" in ua_string:
        device = "Apple iPad"
    elif "Android" in ua_string:
        device = "Android Device"
    elif "Linux" in ua_string:
        device = "Linux Workstation"

    return device, browser


# ─── REGISTER ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user or resume verification for an unverified account."""

    # Normalize email
    email = payload.email.lower().strip()

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        if existing_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account already exists with this email address. Please log in.",
            )
        # Unverified account exists: update password & info, then send new OTP!
        existing_user.full_name = payload.full_name
        existing_user.hashed_password = hash_password(payload.password)
        if payload.mobile:
            existing_user.mobile = payload.mobile
        db.commit()
        db.refresh(existing_user)
        user = existing_user
    else:
        # Check duplicate mobile on active accounts
        if payload.mobile:
            mobile_user = db.query(User).filter(User.mobile == payload.mobile).first()
            if mobile_user and mobile_user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account already exists with this mobile number.",
                )

        # Create user (inactive until OTP verified)
        user = User(
            email=email,
            mobile=payload.mobile,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            is_active=False,
            is_verified=False,
        )
        db.add(user)
        db.flush()  # get user.id without committing

        # Create profile
        profile = Profile(
            user_id=user.id,
            college=payload.college,
            degree=payload.degree,
            branch=payload.branch,
            year_of_study=payload.year_of_study,
            onboarding_completed=False,
        )
        db.add(profile)
        db.commit()
        db.refresh(user)

    # Send OTP
    try:
        otp_info = create_and_send_otp(db, user, OTPPurpose.REGISTRATION)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OTP send failed for {email}: {e}")
        otp_info = {"email_sent": False, "demo_otp": None}

    msg = (
        "Registration initiated! Verification code sent to your email."
        if otp_info.get("email_sent")
        else "Registration initiated! Please enter your verification code."
    )

    demo_otp = otp_info.get("demo_otp") if (not otp_info.get("email_sent") and settings.DEMO_MODE) else None

    return RegisterResponse(
        message=msg,
        user_id=str(user.id),
        email=user.email,
        demo_otp=demo_otp,
        email_sent=otp_info.get("email_sent", False),
    )


# ─── VERIFY REGISTRATION OTP ─────────────────────────────────────────────────

@router.post("/verify-registration-otp", response_model=VerifyOTPResponse)
def verify_registration_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    verify_otp(db, user, payload.otp, OTPPurpose.REGISTRATION)

    # Activate account
    user.is_active = True
    user.is_verified = True
    db.commit()

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return VerifyOTPResponse(
        message="Email verified successfully! Welcome to StudyOS AI.",
        access_token=access_token,
        user={"id": str(user.id), "email": user.email, "full_name": user.full_name},
    )


# ─── LOGIN ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    # Use consistent error to prevent account enumeration
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )

    if not user:
        raise auth_error
    if not verify_password(payload.password, user.hashed_password):
        raise auth_error

    if not user.is_active:
        # Send fresh registration OTP so the user can verify immediately
        try:
            otp_info = create_and_send_otp(db, user, OTPPurpose.REGISTRATION)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Registration OTP send failed during login: {e}")
            otp_info = {"email_sent": False, "demo_otp": None}

        demo_otp = otp_info.get("demo_otp") if (not otp_info.get("email_sent") and settings.DEMO_MODE) else None

        return LoginResponse(
            message="Your account is not verified yet. Verification code has been issued.",
            user_id=str(user.id),
            email=user.email,
            requires_otp=True,
            is_registration_verification=True,
            demo_otp=demo_otp,
            email_sent=otp_info.get("email_sent", False),
        )

    # Send login OTP
    try:
        otp_info = create_and_send_otp(db, user, OTPPurpose.LOGIN)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login OTP send failed: {e}")
        otp_info = {"email_sent": False, "demo_otp": None}

    demo_otp = otp_info.get("demo_otp") if (not otp_info.get("email_sent") and settings.DEMO_MODE) else None

    return LoginResponse(
        message="Credentials verified. Please enter the verification code.",
        user_id=str(user.id),
        email=user.email,
        requires_otp=True,
        is_registration_verification=False,
        demo_otp=demo_otp,
        email_sent=otp_info.get("email_sent", False),
    )


# ─── VERIFY LOGIN OTP ─────────────────────────────────────────────────────────

@router.post("/verify-login-otp", response_model=VerifyOTPResponse)
def verify_login_otp(
    payload: VerifyOTPRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    verify_otp(db, user, payload.otp, OTPPurpose.LOGIN)

    access_token = create_access_token(data={"sub": str(user.id)})

    # Safe Device & Browser Extraction
    ua = request.headers.get("user-agent", "")
    device, browser = parse_user_agent(ua)

    # Format login time in user's timezone (default Asia/Kolkata)
    user_settings = db.query(UserNotificationSettings).filter(UserNotificationSettings.user_id == user.id).first()
    tz_str = user_settings.timezone if (user_settings and user_settings.timezone) else "Asia/Kolkata"

    try:
        from zoneinfo import ZoneInfo
        now_local = datetime.now(ZoneInfo(tz_str))
        formatted_time = now_local.strftime("%d %b %Y, %I:%M %p") + f" ({tz_str})"
    except Exception:
        now_local = datetime.now(timezone.utc)
        formatted_time = now_local.strftime("%d %b %Y, %I:%M %p UTC")

    # In-App Notification (Recorded for security audit log)
    notif = Notification(
        user_id=user.id,
        title="🔐 New login detected",
        message=f"Logged in from {browser} on {device} ({formatted_time})",
        category="security",
        link="/settings",
    )
    db.add(notif)
    db.commit()

    # Email notification (if user has login alerts enabled)
    should_send_email = True
    if user_settings and (user_settings.login_alerts is False or user_settings.email_notifications is False):
        should_send_email = False

    if should_send_email and is_smtp_configured():
        background_tasks.add_task(
            send_login_notification_email,
            recipient_email=user.email,
            recipient_name=user.full_name,
            login_time=formatted_time,
            device=device,
            browser=browser,
        )

    return VerifyOTPResponse(
        message="Login successful! Welcome back.",
        access_token=access_token,
        user={"id": str(user.id), "email": user.email, "full_name": user.full_name},
    )


# ─── RESEND OTP ───────────────────────────────────────────────────────────────

@router.post("/resend-otp")
def resend_otp(payload: ResendOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    purpose_map = {
        "registration": OTPPurpose.REGISTRATION,
        "login": OTPPurpose.LOGIN,
        "password_reset": OTPPurpose.PASSWORD_RESET,
    }
    purpose = purpose_map.get(payload.purpose)
    if not purpose:
        raise HTTPException(status_code=400, detail="Invalid OTP purpose.")

    info = create_and_send_otp(db, user, purpose)
    if info.get("email_sent") or not settings.DEMO_MODE:
        info["demo_otp"] = None
    return {
        "message": "A new verification code has been sent.",
        **info,
    }


# ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email, User.is_active == True).first()

    # Always return the same message to prevent account enumeration
    generic_message = "If an account exists with this email, a password reset code has been sent."

    if not user:
        return ForgotPasswordResponse(message=generic_message, user_id="")

    otp_info = None
    try:
        otp_info = create_and_send_otp(db, user, OTPPurpose.PASSWORD_RESET)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset OTP failed: {e}")

    demo_otp = (
        otp_info.get("demo_otp")
        if (otp_info and not otp_info.get("email_sent") and settings.DEMO_MODE)
        else None
    )

    return ForgotPasswordResponse(
        message=generic_message,
        user_id=str(user.id),
        demo_otp=demo_otp,
        email_sent=otp_info.get("email_sent", True) if otp_info else False,
    )



# ─── RESET PASSWORD ───────────────────────────────────────────────────────────

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    verify_otp(db, user, payload.otp, OTPPurpose.PASSWORD_RESET)

    user.hashed_password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password reset successfully. Please log in with your new password."}


# ─── LOGOUT ───────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout():
    """
    Client-side logout: discard JWT token.
    For server-side invalidation, implement a token blacklist using Redis.
    """
    return {"message": "Logged out successfully."}
