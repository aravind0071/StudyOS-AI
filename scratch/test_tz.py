import sys
from pathlib import Path
sys.path.append(str(Path('.').resolve() / 'backend'))

from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.models import User, OTPPurpose, OTPVerification
from app.services.otp_service import _generate_otp, _hash_otp, create_and_send_otp, verify_otp

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == 'sai.vamsi@studyos.ai').first()
    otp_record = (
        db.query(OTPVerification)
        .filter(OTPVerification.user_id == user.id, OTPVerification.purpose == OTPPurpose.LOGIN)
        .order_by(OTPVerification.created_at.desc())
        .first()
    )
    print("Record expires_at:", repr(otp_record.expires_at), "tzinfo:", otp_record.expires_at.tzinfo)
    print("Now UTC:", repr(datetime.now(timezone.utc)))
    now = datetime.now(timezone.utc)
    exp = otp_record.expires_at if otp_record.expires_at.tzinfo else otp_record.expires_at.replace(tzinfo=timezone.utc)
    print("Is expired?", exp < now)
finally:
    db.close()
