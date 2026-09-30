"""
Reminders Router — StudyOS AI
Automated study session reminders (15 mins before) and exam countdown alerts (2 days, 1 day, exam day).
Handles timezones with Indian Standard Time (Asia/Kolkata) as default.
Prevents duplicate notifications and respects user notification preferences.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import (
    User, Exam, StudySession, Notification, UserNotificationSettings, Subject
)
from app.services.email_service import (
    send_study_reminder_email,
    send_exam_reminder_email,
    is_smtp_configured,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reminders", tags=["Study & Exam Reminders"])


# ─── SCHEMAS ──────────────────────────────────────────────────────────────────

class StudySessionCreate(BaseModel):
    subject_name: str
    unit_name: Optional[str] = None
    subject_id: Optional[str] = None
    session_date: str  # YYYY-MM-DD
    start_time: str    # e.g. "07:00 PM"
    end_time: str      # e.g. "09:00 PM"
    reminder_lead_minutes: Optional[int] = 15


class ExamCreate(BaseModel):
    subject_name: str
    subject_id: Optional[str] = None
    exam_date: str     # YYYY-MM-DD
    exam_time: Optional[str] = "10:00 AM - 01:00 PM"
    recommended_topics: Optional[List[str]] = None


# ─── TIMEZONE HELPERS ─────────────────────────────────────────────────────────

def _get_user_tz(user_id: str, db: Session) -> str:
    """Retrieve user configured timezone, defaulting to Asia/Kolkata."""
    settings = db.query(UserNotificationSettings).filter(UserNotificationSettings.user_id == user_id).first()
    return settings.timezone if (settings and settings.timezone) else "Asia/Kolkata"


def _parse_time_to_minutes(t_str: str) -> int:
    """Parse 12-hour or 24-hour time string into minutes from midnight."""
    cleaned = t_str.strip().upper()
    is_pm = "PM" in cleaned
    is_am = "AM" in cleaned
    raw = cleaned.replace("AM", "").replace("PM", "").strip()
    parts = raw.split(":")
    hours = int(parts[0]) if parts[0] else 0
    mins = int(parts[1]) if len(parts) > 1 and parts[1] else 0
    if is_pm and hours < 12:
        hours += 12
    elif is_am and hours == 12:
        hours = 0
    return hours * 60 + mins


# ─── STUDY SESSION ENDPOINTS ──────────────────────────────────────────────────

@router.get("/sessions")
def list_study_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all scheduled study sessions for the authenticated user."""
    sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id)
        .order_by(StudySession.session_date.asc())
        .all()
    )
    return [
        {
            "id": str(s.id),
            "subject_name": s.subject_name,
            "unit_name": s.unit_name,
            "session_date": s.session_date.strftime("%Y-%m-%d") if s.session_date else None,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "reminder_lead_minutes": s.reminder_lead_minutes,
            "reminder_sent": s.reminder_sent,
        }
        for s in sessions
    ]


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_study_session(
    payload: StudySessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Schedule a new study session with automated 15-minute advance reminder."""
    try:
        session_dt = datetime.strptime(payload.session_date.strip()[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        session_dt = datetime.now(timezone.utc)

    session = StudySession(
        user_id=current_user.id,
        subject_id=payload.subject_id,
        subject_name=payload.subject_name.strip(),
        unit_name=payload.unit_name.strip() if payload.unit_name else None,
        session_date=session_dt,
        start_time=payload.start_time.strip(),
        end_time=payload.end_time.strip(),
        reminder_lead_minutes=payload.reminder_lead_minutes or 15,
        reminder_sent=False,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "message": f"Study session for '{session.subject_name}' scheduled successfully.",
        "id": str(session.id),
        "start_time": session.start_time,
        "end_time": session.end_time,
    }


@router.delete("/sessions/{session_id}")
def delete_study_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel and delete a scheduled study session."""
    session = (
        db.query(StudySession)
        .filter(StudySession.id == session_id, StudySession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found.")

    db.delete(session)
    db.commit()
    return {"message": "Study session cancelled."}


# ─── EXAM ENDPOINTS ───────────────────────────────────────────────────────────

@router.get("/exams")
def list_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List scheduled exams with calculated countdown days."""
    exams = (
        db.query(Exam)
        .filter(Exam.user_id == current_user.id)
        .order_by(Exam.exam_date.asc())
        .all()
    )
    tz_str = _get_user_tz(str(current_user.id), db)
    try:
        now_local = datetime.now(ZoneInfo(tz_str)).date()
    except Exception:
        now_local = datetime.now(timezone.utc).date()

    results = []
    for e in exams:
        exam_d = e.exam_date.date() if hasattr(e.exam_date, 'date') else e.exam_date
        days_remaining = (exam_d - now_local).days
        results.append({
            "id": str(e.id),
            "subject_name": e.subject_name,
            "exam_date": exam_d.strftime("%d %B %Y") if hasattr(exam_d, 'strftime') else str(exam_d),
            "raw_date": exam_d.isoformat() if hasattr(exam_d, 'isoformat') else str(exam_d),
            "exam_time": e.exam_time,
            "days_remaining": days_remaining,
            "recommended_topics": e.recommended_topics or [],
            "reminder_2day_sent": e.reminder_2day_sent,
            "reminder_1day_sent": e.reminder_1day_sent,
        })
    return results


@router.post("/exams", status_code=status.HTTP_201_CREATED)
def create_exam(
    payload: ExamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an exam with automatic 2-day and 1-day advance countdown reminders."""
    try:
        exam_dt = datetime.strptime(payload.exam_date.strip()[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Default recommended topics if empty
    recs = payload.recommended_topics or ["Unit 3 (Important questions)", "Unit 4 (Quick revision)"]

    exam = Exam(
        user_id=current_user.id,
        subject_id=payload.subject_id,
        subject_name=payload.subject_name.strip(),
        exam_date=exam_dt,
        exam_time=payload.exam_time.strip() if payload.exam_time else "10:00 AM - 01:00 PM",
        recommended_topics=recs,
        reminder_2day_sent=False,
        reminder_1day_sent=False,
        reminder_examday_sent=False,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    return {
        "message": f"Exam for '{exam.subject_name}' scheduled successfully.",
        "id": str(exam.id),
        "exam_date": exam.exam_date.strftime("%Y-%m-%d"),
    }


@router.delete("/exams/{exam_id}")
def delete_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a scheduled exam."""
    exam = (
        db.query(Exam)
        .filter(Exam.id == exam_id, Exam.user_id == current_user.id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    db.delete(exam)
    db.commit()
    return {"message": "Exam deleted."}


# ─── REMINDER CHECK & DISPATCH PIPELINE ──────────────────────────────────────

@router.post("/check-and-dispatch")
def check_and_dispatch_reminders(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Checks upcoming study sessions and exams for the user.
    Dispatches 15-minute advance study alerts and 2-day/1-day exam reminders.
    Never sends duplicates.
    """
    user_id = str(current_user.id)
    user_settings = db.query(UserNotificationSettings).filter(UserNotificationSettings.user_id == user_id).first()
    tz_str = user_settings.timezone if (user_settings and user_settings.timezone) else "Asia/Kolkata"

    try:
        now_local = datetime.now(ZoneInfo(tz_str))
    except Exception:
        now_local = datetime.now(timezone.utc)

    today_str = now_local.strftime("%Y-%m-%d")
    current_mins = now_local.hour * 60 + now_local.minute

    dispatched = []

    # 1. Evaluate Study Sessions (Today)
    if not user_settings or user_settings.study_reminders is not False:
        sessions = (
            db.query(StudySession)
            .filter(
                StudySession.user_id == user_id,
                StudySession.reminder_sent == False,
            )
            .all()
        )

        for s in sessions:
            s_date_str = s.session_date.strftime("%Y-%m-%d") if s.session_date else ""
            if s_date_str == today_str:
                start_mins = _parse_time_to_minutes(s.start_time)
                diff = start_mins - current_mins
                lead = s.reminder_lead_minutes or 15

                # Within reminder window (e.g. 0 to 15 minutes before)
                if 0 <= diff <= lead:
                    s.reminder_sent = True
                    db.commit()

                    session_title = f"{s.subject_name}" + (f" - {s.unit_name}" if s.unit_name else "")
                    time_window = f"{s.start_time} - {s.end_time}"

                    # In-app Notification
                    notif = Notification(
                        user_id=user_id,
                        title="📚 Study session starts in 15 minutes",
                        message=f"{session_title} starts at {s.start_time} ({time_window}).",
                        category="study",
                        link="/study-plan",
                    )
                    db.add(notif)
                    db.commit()

                    # Email Dispatch
                    if is_smtp_configured() and (not user_settings or user_settings.email_notifications is not False):
                        background_tasks.add_task(
                            send_study_reminder_email,
                            recipient_email=current_user.email,
                            recipient_name=current_user.full_name,
                            session_title=session_title,
                            time_window=time_window,
                            lead_minutes=lead,
                        )
                    dispatched.append(f"Study reminder for {session_title}")

    # 2. Evaluate Exams (2-day, 1-day, exam day countdowns)
    if not user_settings or user_settings.exam_reminders is not False:
        exams = db.query(Exam).filter(Exam.user_id == user_id).all()
        today_date = now_local.date()

        for e in exams:
            e_date = e.exam_date.date() if hasattr(e.exam_date, 'date') else e.exam_date
            remaining_days = (e_date - today_date).days

            # 2 Days Before
            if remaining_days == 2 and not e.reminder_2day_sent:
                if not user_settings or user_settings.exam_reminder_2days is not False:
                    e.reminder_2day_sent = True
                    db.commit()

                    notif = Notification(
                        user_id=user_id,
                        title=f"📝 {e.subject_name} exam in 2 days",
                        message=f"Exam scheduled for {e_date.strftime('%d %B %Y')}. Recommended: Revise {', '.join(e.recommended_topics or ['Unit 3', 'Unit 4'])}.",
                        category="exam",
                        link="/exam-readiness",
                    )
                    db.add(notif)
                    db.commit()

                    if is_smtp_configured() and (not user_settings or user_settings.email_notifications is not False):
                        background_tasks.add_task(
                            send_exam_reminder_email,
                            recipient_email=current_user.email,
                            recipient_name=current_user.full_name,
                            exam_name=e.subject_name,
                            exam_date=e_date.strftime("%d %B %Y"),
                            days_remaining=2,
                            recommended_topics=e.recommended_topics or [],
                        )
                    dispatched.append(f"2-day exam reminder for {e.subject_name}")

            # 1 Day Before
            elif remaining_days == 1 and not e.reminder_1day_sent:
                if not user_settings or user_settings.exam_reminder_1day is not False:
                    e.reminder_1day_sent = True
                    db.commit()

                    notif = Notification(
                        user_id=user_id,
                        title=f"📝 {e.subject_name} exam tomorrow",
                        message=f"Your {e.subject_name} exam is tomorrow! Focus on weak topics, quick revision, and rest well.",
                        category="exam",
                        link="/exam-readiness",
                    )
                    db.add(notif)
                    db.commit()

                    if is_smtp_configured() and (not user_settings or user_settings.email_notifications is not False):
                        background_tasks.add_task(
                            send_exam_reminder_email,
                            recipient_email=current_user.email,
                            recipient_name=current_user.full_name,
                            exam_name=e.subject_name,
                            exam_date=e_date.strftime("%d %B %Y"),
                            days_remaining=1,
                            recommended_topics=e.recommended_topics or [],
                        )
                    dispatched.append(f"1-day exam reminder for {e.subject_name}")

            # Exam Day
            elif remaining_days == 0 and not e.reminder_examday_sent:
                if not user_settings or user_settings.exam_reminder_day_of is not False:
                    e.reminder_examday_sent = True
                    db.commit()

                    notif = Notification(
                        user_id=user_id,
                        title=f"🎯 {e.subject_name} exam TODAY!",
                        message=f"Today is your {e.subject_name} exam! Review your quick formula flashcards and give your best effort.",
                        category="exam",
                        link="/exam-readiness",
                    )
                    db.add(notif)
                    db.commit()
                    dispatched.append(f"Exam day alert for {e.subject_name}")

    return {
        "dispatched_count": len(dispatched),
        "dispatched_events": dispatched,
        "checked_at": now_local.strftime("%d %b %Y, %I:%M %p") + f" ({tz_str})",
    }
