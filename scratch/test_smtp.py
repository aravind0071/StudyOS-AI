import sys
from pathlib import Path
sys.path.append(str(Path('.').resolve() / 'backend'))

import smtplib
from app.core.config import settings

print("Testing SMTP connection to:", settings.SMTP_HOST, settings.SMTP_PORT)
print("User:", settings.SMTP_USER)

try:
    with smtplib.SMTP(settings.SMTP_HOST, int(settings.SMTP_PORT), timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        print("SUCCESS! SMTP authenticated successfully!")
except Exception as e:
    print("FAILED! SMTP error:", type(e), e)
