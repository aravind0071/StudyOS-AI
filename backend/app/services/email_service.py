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

def _dispatch_email(recipient_email: str, msg: MIMEMultipart, log_tag: str) -> tuple[bool, str | None]:
    """Helper to dispatch email via configured SMTP with TLS/SSL."""
    if not is_smtp_configured():
        msg_str = "SMTP is not configured in backend/.env. Mail delivery skipped."
        logger.warning(f"[EMAIL SERVICE] {msg_str}")
        return False, msg_str

    port = int(settings.SMTP_PORT or 587)
    timeout = 15

    try:
        if port == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, port, timeout=timeout) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, [recipient_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, port, timeout=timeout) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, [recipient_email], msg.as_string())

        logger.info(f"✅ [{log_tag}] Email delivered to {recipient_email}")
        return True, None
    except smtplib.SMTPAuthenticationError as e:
        err = f"SMTP Authentication failed: {e}"
        logger.error(f"[EMAIL SERVICE] {err}")
        return False, err
    except Exception as e:
        err = f"Failed to send email to {recipient_email}: {e}"
        logger.error(f"[EMAIL SERVICE] {err}")
        return False, str(e)


def send_otp_email(
    recipient_email: str,
    recipient_name: str,
    otp: str,
    purpose: str,
    expires_minutes: int,
) -> tuple[bool, str | None]:
    """Send OTP via SMTP with optimal deliverability headers."""
    if not is_smtp_configured():
        return False, "SMTP is not configured in backend/.env."

    subject = "StudyOS AI portal verification code"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"StudyOS AI <{settings.SMTP_USER}>"
    msg["To"] = recipient_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="studyos.ai")
    msg["Reply-To"] = settings.SMTP_USER
    msg["Auto-Submitted"] = "auto-generated"

    text_content = _build_otp_email_text(recipient_name or "Student", otp, purpose, expires_minutes)
    html_content = _build_otp_email_html(recipient_name or "Student", otp, purpose, expires_minutes)

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    return _dispatch_email(recipient_email, msg, f"OTP-{purpose}")


def send_login_notification_email(
    recipient_email: str,
    recipient_name: str,
    login_time: str,
    device: str,
    browser: str,
) -> tuple[bool, str | None]:
    """Send notification email when a new successful login occurs."""
    user_display = recipient_name or "Student"
    subject = "StudyOS AI - New Login Detected"

    text_content = (
        f"Hello {user_display},\n\n"
        f"A new login to your StudyOS AI account was detected.\n\n"
        f"Login time:\n{login_time}\n\n"
        f"Device:\n{device}\n\n"
        f"Browser:\n{browser}\n\n"
        f"If this was you, no action is required.\n\n"
        f"If you do not recognize this login, please secure your account immediately by changing your password.\n\n"
        f"Regards,\nStudyOS AI"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Login Detected</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          <tr>
            <td style="background:linear-gradient(135deg,#0284c7,#2563eb);padding:24px 28px;text-align:left;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">🔐 New Login Detected</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">StudyOS AI Security Alert</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;color:#f8fafc;font-size:15px;font-weight:600;">Hello {user_display},</p>
              <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;line-height:1.5;">
                A new login to your StudyOS AI account was detected:
              </p>
              <table role="presentation" width="100%" style="background-color:#0f172a;border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,0.06);margin-bottom:20px;">
                <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;width:110px;">Login time:</td><td style="color:#f8fafc;font-size:13px;font-weight:600;padding:4px 0;">{login_time}</td></tr>
                <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Device:</td><td style="color:#38bdf8;font-size:13px;font-weight:600;padding:4px 0;">{device}</td></tr>
                <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Browser:</td><td style="color:#a78bfa;font-size:13px;font-weight:600;padding:4px 0;">{browser}</td></tr>
              </table>
              <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;line-height:1.5;">
                If this was you, no action is required.
              </p>
              <p style="margin:0;color:#ef4444;font-size:12px;line-height:1.4;">
                If you do not recognize this activity, please log in immediately and change your account password.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#090d16;padding:16px 28px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:#475569;font-size:11px;">StudyOS AI · Automated Security Notification</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"StudyOS AI <{settings.SMTP_USER}>"
    msg["To"] = recipient_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="studyos.ai")
    msg["Reply-To"] = settings.SMTP_USER

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    return _dispatch_email(recipient_email, msg, "LOGIN-ALERT")


def send_study_reminder_email(
    recipient_email: str,
    recipient_name: str,
    session_title: str,
    time_window: str,
    lead_minutes: int = 15,
) -> tuple[bool, str | None]:
    """Send study session starting soon reminder."""
    user_display = recipient_name or "Student"
    subject = "StudyOS AI - Study Time Reminder"

    text_content = (
        f"Hello {user_display},\n\n"
        f"Your study session starts in {lead_minutes} minutes.\n\n"
        f"Today's session:\n{session_title}\n\n"
        f"Time:\n{time_window}\n\n"
        f"Good luck with your study session!\n\n"
        f"StudyOS AI"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Study Reminder</title></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b,#ea580c);padding:24px 28px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">📚 Study Session Reminder</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Starting in {lead_minutes} minutes</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 16px;color:#f8fafc;font-size:15px;font-weight:600;">Hello {user_display},</p>
            <p style="margin:0 0 16px;color:#cbd5e1;font-size:14px;">Your scheduled study session is about to begin:</p>
            <div style="background-color:#0f172a;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:20px;">
              <div style="color:#fbbf24;font-size:16px;font-weight:700;margin-bottom:6px;">{session_title}</div>
              <div style="color:#94a3b8;font-size:13px;">⏰ {time_window}</div>
            </div>
            <p style="margin:0;color:#94a3b8;font-size:13px;">Keep up your focus and momentum. Good luck!</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#090d16;padding:16px 28px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:#475569;font-size:11px;">StudyOS AI · Automated Study Reminder</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"StudyOS AI <{settings.SMTP_USER}>"
    msg["To"] = recipient_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="studyos.ai")
    msg["Reply-To"] = settings.SMTP_USER

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    return _dispatch_email(recipient_email, msg, "STUDY-REMINDER")


def send_exam_reminder_email(
    recipient_email: str,
    recipient_name: str,
    exam_name: str,
    exam_date: str,
    days_remaining: int,
    recommended_topics: list[str] = None,
) -> tuple[bool, str | None]:
    """Send exam countdown reminder."""
    user_display = recipient_name or "Student"
    subject = "StudyOS AI - Exam Reminder"
    rec_topics_text = ", ".join(recommended_topics) if recommended_topics else "key units and practice problems"

    if days_remaining == 1:
        headline = f"Your {exam_name} exam is tomorrow."
        guidance = "Use the remaining time for:\n- Important questions\n- Weak topics\n- Quick revision\n- Practice"
    elif days_remaining == 0:
        headline = f"Your {exam_name} exam is TODAY."
        guidance = "Stay confident, review summary flashcards, and give it your best!"
    else:
        headline = f"Your {exam_name} exam is in {days_remaining} days."
        guidance = f"Recommended: Revise {rec_topics_text}."

    text_content = (
        f"Hello {user_display},\n\n"
        f"{headline}\n\n"
        f"Exam:\n{exam_name}\n\n"
        f"Date:\n{exam_date}\n\n"
        f"Remaining:\n{days_remaining} days\n\n"
        f"{guidance}\n\n"
        f"Regards,\nStudyOS AI"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Exam Reminder</title></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#9333ea);padding:24px 28px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">📝 Exam Countdown Alert</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">{headline}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 16px;color:#f8fafc;font-size:15px;font-weight:600;">Hello {user_display},</p>
            <div style="background-color:#0f172a;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:18px;font-weight:700;color:#f8fafc;margin-bottom:6px;">{exam_name}</div>
              <div style="font-size:13px;color:#94a3b8;margin-bottom:4px;">📅 Date: <strong style="color:#e2e8f0;">{exam_date}</strong></div>
              <div style="font-size:13px;color:#f87171;">⏳ Remaining: <strong>{days_remaining} {'day' if days_remaining == 1 else 'days'}</strong></div>
            </div>
            <div style="color:#cbd5e1;font-size:14px;line-height:1.5;">
              {guidance.replace(chr(10), '<br>')}
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#090d16;padding:16px 28px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:#475569;font-size:11px;">StudyOS AI · Automated Academic Notification</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"StudyOS AI <{settings.SMTP_USER}>"
    msg["To"] = recipient_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="studyos.ai")
    msg["Reply-To"] = settings.SMTP_USER

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    return _dispatch_email(recipient_email, msg, f"EXAM-{days_remaining}D")


