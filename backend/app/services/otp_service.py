"""
OTP Service — StudyOS AI
- Generates cryptographically secure 6-digit OTPs
- Stores SHA-256 hash (never plain text)
- Enforces expiry, attempt limits, and resend cooldown
- Sends OTP via SMTP email (or logs to console in DEMO_MODE)
"""

import hashlib
import secrets
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.models import OTPVerification, OTPPurpose, User
from app.services.email_service import send_otp_email, is_smtp_configured

logger = logging.getLogger(__name__)


def _hash_otp(otp: str) -> str:
    """SHA-256 hash of the OTP string."""
    return hashlib.sha256(otp.encode()).hexdigest()


def _generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return f"{secrets.randbelow(900000) + 100000:06d}"


def create_and_send_otp(db: Session, user: User, purpose: OTPPurpose) -> dict:
    """
    Create a new OTP for the user, persist its hash, and send via email.
    If SMTP is configured, sends a real email.
    If SMTP is unconfigured or fails, returns demo_otp for development convenience.
    """
    now = datetime.now(timezone.utc)

    # Check existing OTP for resend cooldown
    existing = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.user_id == user.id,
            OTPVerification.purpose == purpose,
            OTPVerification.is_used == False,
        )
        .first()
    )

    if existing:
        cooldown_seconds = (
            5 if (not is_smtp_configured() or settings.DEMO_MODE)
            else settings.OTP_RESEND_COOLDOWN_SECONDS
        )
        last_sent = (
            existing.last_sent_at
            if (existing.last_sent_at and existing.last_sent_at.tzinfo)
            else (existing.last_sent_at.replace(tzinfo=timezone.utc) if existing.last_sent_at else now)
        )
        cooldown_end = last_sent + timedelta(seconds=cooldown_seconds)
        if now < cooldown_end:
            wait_seconds = int((cooldown_end - now).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_seconds} seconds before requesting a new OTP.",
            )
        # Invalidate the old OTP
        existing.is_used = True
        db.flush()

    otp = _generate_otp()
    otp_hash = _hash_otp(otp)
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    otp_record = OTPVerification(
        user_id=user.id,
        purpose=purpose,
        otp_hash=otp_hash,
        expires_at=expires_at,
        last_sent_at=now,
    )
    db.add(otp_record)
    db.commit()

    email_sent = False
    demo_otp: str | None = None

    # Attempt real email dispatch if SMTP is configured and not in DEMO_MODE
    if is_smtp_configured() and not settings.DEMO_MODE:
        email_sent, delivery_error = send_otp_email(
            recipient_email=user.email,
            recipient_name=user.full_name,
            otp=otp,
            purpose=purpose.value,
            expires_minutes=settings.OTP_EXPIRE_MINUTES,
        )
        if email_sent:
            logger.info(f"✉️ [AUTH OTP] Verification code successfully sent to {user.email} ({purpose.value})")
        else:
            logger.warning(
                f"[AUTH OTP] Email delivery failed for {user.email}: {delivery_error}. "
                f"Falling back to instant code verification mode."
            )
            demo_otp = otp
    else:
        logger.info(f"🔑 [AUTH OTP DEV] Verification code for {user.email} ({purpose.value}): {otp}")
        demo_otp = otp

    return {
        "user_id": str(user.id),
        "email": user.email,
        "expires_in_seconds": settings.OTP_EXPIRE_MINUTES * 60,
        "email_sent": email_sent,
        "demo_otp": demo_otp,
    }


def verify_otp(db: Session, user: User, otp_input: str, purpose: OTPPurpose) -> bool:
    """
    Verify OTP for given user and purpose.
    Raises HTTPException on invalid, expired, or exhausted attempts.
    Returns True on success. Strictly validates real SHA-256 hash.
    Provides clear, accurate status messages (expired, already used, or attempts exhausted).
    """
    now = datetime.now(timezone.utc)

    # Query the most recent OTP record for this user and purpose
    otp_record = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.user_id == user.id,
            OTPVerification.purpose == purpose,
        )
        .order_by(OTPVerification.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code found. Please request a new code.",
        )

    # Determine timezone-aware UTC datetime for expiration
    record_expires_at = (
        otp_record.expires_at
        if otp_record.expires_at.tzinfo
        else otp_record.expires_at.replace(tzinfo=timezone.utc)
    )

    # 15-second grace window to absorb network latency / transit delay
    grace_delta = timedelta(seconds=15)
    is_expired = (record_expires_at + grace_delta) < now

    if is_expired:
        if not otp_record.is_used:
            otp_record.is_used = True
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    if otp_record.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has already been used. Please request a new code.",
        )

    if otp_record.attempts >= settings.OTP_MAX_ATTEMPTS:
        otp_record.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect attempts. Please request a new verification code.",
        )

    otp_record.attempts += 1
    db.flush()

    # Strictly validate against the SHA-256 hash of the generated OTP
    is_valid = otp_record.otp_hash == _hash_otp(otp_input.strip())

    if not is_valid:
        remaining = max(0, settings.OTP_MAX_ATTEMPTS - otp_record.attempts)
        if remaining == 0:
            otp_record.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining} attempt(s) remaining.",
        )

    # Success — mark as used
    otp_record.is_used = True
    db.commit()
    return True
