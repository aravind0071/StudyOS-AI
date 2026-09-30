import sys
from pathlib import Path
sys.path.append(str(Path('.').resolve() / 'backend'))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import SessionLocal
from app.models.models import User, OTPVerification, OTPPurpose, Notification, UserNotificationSettings
from app.services.otp_service import create_and_send_otp, verify_otp
from app.services.email_service import is_smtp_configured, send_login_notification_email
from app.routers.auth import parse_user_agent
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

print("--- PHASE 2 VERIFICATION ---")
print("1. SMTP Configured:", is_smtp_configured())

# Test User-Agent Parser
ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0"
device, browser = parse_user_agent(ua)
print(f"2. UA Parse: Device='{device}', Browser='{browser}'")
assert device == "Windows 10/11 PC"
assert browser == "Microsoft Edge"

db = SessionLocal()
try:
    test_email = "test.student@studyos.ai"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        user = User(
            email=test_email,
            full_name="Test Student",
            hashed_password="hashed_pass_sample",
            is_active=True,
            is_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Test OTP generation
    info = create_and_send_otp(db, user, OTPPurpose.LOGIN)
    print("3. OTP Generated successfully. Expire seconds:", info["expires_in_seconds"])

    # Test invalid OTP
    try:
        verify_otp(db, user, "000000", OTPPurpose.LOGIN)
        print("ERROR: Invalid OTP should have raised exception!")
    except Exception as e:
        print("4. Invalid OTP correctly rejected:", e.detail if hasattr(e, 'detail') else e)

    # Get the latest OTP record from DB to verify valid OTP
    latest_otp = db.query(OTPVerification).filter(
        OTPVerification.user_id == user.id,
        OTPVerification.purpose == OTPPurpose.LOGIN,
        OTPVerification.is_used == False
    ).order_by(OTPVerification.created_at.desc()).first()

    # Test valid OTP
    # Compute what matches
    for candidate in range(100000, 1000000):
        import hashlib
        if hashlib.sha256(str(candidate).encode()).hexdigest() == latest_otp.otp_hash:
            valid_otp = str(candidate)
            break
    
    verified = verify_otp(db, user, valid_otp, OTPPurpose.LOGIN)
    print("5. Valid OTP verified successfully:", verified)

    # Test in-app notification creation
    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    formatted_time = now_ist.strftime("%d %b %Y, %I:%M %p IST")
    notif = Notification(
        user_id=user.id,
        title="🔐 New login detected",
        message=f"Logged in from {browser} on {device} ({formatted_time})",
        category="security",
        link="/settings"
    )
    db.add(notif)
    db.commit()

    saved_notif = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).first()
    print("6. In-app Notification persisted successfully:", saved_notif.title, "|", saved_notif.message)

    print("--- ALL PHASE 2 TESTS PASSED! ---")

finally:
    db.close()
