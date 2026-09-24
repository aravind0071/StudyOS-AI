"""Email service — sends transactional emails via SMTP with high inbox deliverability."""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_otp_email_text(
    recipient_name: str, otp: str, purpose: str, expires_minutes: int
) -> str:
    user_display = recipient_name or "User"
    return (
        f"Dear {user_display}!\n\n"
        f"Please find your portal access verification code:\n"
        f"{otp}\n\n"
        f"This code is valid for {expires_minutes} minutes. Never share this code with anyone.\n"
        f"If you did not request this verification, please ignore this email.\n\n"
        f"— StudyOS AI"
    )


def _build_otp_email_html(
    recipient_name: str, otp: str, purpose: str, expires_minutes: int
) -> str:
    user_display = recipient_name or "User"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyOS AI portal verification code</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#10b981);padding:28px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">StudyOS AI</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:12px;font-weight:500;">Learning Operating System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px 24px;">
              <p style="margin:0 0 16px;color:#f8fafc;font-size:16px;font-weight:700;">Dear {user_display}!</p>
              <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;line-height:1.5;">
                Please find your portal access verification code:
              </p>
              
              <!-- Code Box -->
              <div style="background-color:#0f172a;border:2px solid #10b981;border-radius:12px;padding:20px 16px;text-align:center;margin:0 0 24px;">
                <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#10b981;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{otp}</div>
              </div>

              <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.5;">
                This code is valid for <strong>{expires_minutes} minutes</strong>. Never share this code with anyone.
              </p>

              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.4;">
                If you did not request this verification code, please ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#090d16;padding:16px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:#475569;font-size:11px;">
                © 2026 StudyOS AI. Automated verification message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def is_smtp_configured() -> bool:
    """Check if SMTP credentials are fully configured."""
    return bool(
        settings.SMTP_HOST
        and str(settings.SMTP_HOST).strip()
        and settings.SMTP_USER
        and str(settings.SMTP_USER).strip()
        and settings.SMTP_PASSWORD
        and str(settings.SMTP_PASSWORD).strip()
    )


def send_otp_email(
    recipient_email: str,
    recipient_name: str,
    otp: str,
    purpose: str,
    expires_minutes: int,
) -> tuple[bool, str | None]:
    """
    Send OTP via SMTP with optimal inbox deliverability headers.
    Returns (success: bool, error_message: str | None).
    """
    if not is_smtp_configured():
        msg = "SMTP is not configured in backend/.env. Mail delivery skipped."
        logger.warning(f"[EMAIL SERVICE] {msg}")
        return False, msg

    # Subject line matching Gmail Smart Card parser format
    subject = f"StudyOS AI portal verification code"

    # Multipart alternative containing both text and html versions for anti-spam compliance
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    
    # Ensure 'From' header cleanly matches authenticated SMTP_USER
    sender_name = "StudyOS AI"
    clean_sender = f"{sender_name} <{settings.SMTP_USER}>"
    msg["From"] = clean_sender
    msg["To"] = recipient_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="gmail.com")
    msg["Reply-To"] = settings.SMTP_USER
    msg["Auto-Submitted"] = "auto-generated"
    msg["X-Auto-Response-Suppress"] = "All"
    msg["X-Priority"] = "1"
    msg["Importance"] = "High"

    # Attach plain text version first, then HTML version (RFC 2046 compliant)
    text_content = _build_otp_email_text(recipient_name or "Student", otp, purpose, expires_minutes)
    html_content = _build_otp_email_html(recipient_name or "Student", otp, purpose, expires_minutes)

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    port = int(settings.SMTP_PORT or 587)
    timeout = 15  # 15s connection timeout

    try:
        if port == 465:
            # Direct SSL
            with smtplib.SMTP_SSL(settings.SMTP_HOST, port, timeout=timeout) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, [recipient_email], msg.as_string())
        else:
            # STARTTLS (port 587)
            with smtplib.SMTP(settings.SMTP_HOST, port, timeout=timeout) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, [recipient_email], msg.as_string())

        logger.info(f"✅ OTP email successfully delivered to inbox for {recipient_email} ({purpose})")
        return True, None

    except smtplib.SMTPAuthenticationError as e:
        err = f"SMTP Authentication failed. Please verify your Gmail 16-character App Password in backend/.env: {e}"
        logger.error(f"[EMAIL SERVICE] {err}")
        return False, err

    except Exception as e:
        err = f"Failed to send email to {recipient_email}: {e}"
        logger.error(f"[EMAIL SERVICE] {err}")
        return False, str(e)


