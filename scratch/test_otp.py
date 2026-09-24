import sys
from pathlib import Path
sys.path.append(str(Path('.').resolve() / 'backend'))

from app.core.database import SessionLocal
from app.models.models import User, OTPPurpose, OTPVerification
from app.services.otp_service import create_and_send_otp, verify_otp
from app.services.email_service import is_smtp_configured

print("SMTP configured:", is_smtp_configured())
db = SessionLocal()
try:
    user = db.query(User).filter(User.email == 'sai.vamsi@studyos.ai').first()
    print("Found user:", user.email, user.full_name, "active:", user.is_active)
    
    # Check last OTP
    last_otp = db.query(OTPVerification).filter(OTPVerification.user_id == user.id).order_by(OTPVerification.created_at.desc()).first()
    if last_otp:
        print("Last OTP purpose:", last_otp.purpose, "is_used:", last_otp.is_used, "attempts:", last_otp.attempts, "created_at:", last_otp.created_at)
finally:
    db.close()
