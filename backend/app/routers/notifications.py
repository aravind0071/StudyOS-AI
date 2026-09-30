"""
Notifications Router — StudyOS AI
In-app notification center and user notification preferences.
Strictly scoped to current authenticated user.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User, Notification, UserNotificationSettings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationSettingsUpdate(BaseModel):
    email_notifications: Optional[bool] = None
    login_alerts: Optional[bool] = None
    study_reminders: Optional[bool] = None
    exam_reminders: Optional[bool] = None
    study_plan_reminders: Optional[bool] = None
    in_app_notifications: Optional[bool] = None
    reminder_minutes_before: Optional[int] = None
    exam_reminder_2days: Optional[bool] = None
    exam_reminder_1day: Optional[bool] = None
    exam_reminder_day_of: Optional[bool] = None
    timezone: Optional[str] = None


@router.get("")
@router.get("/")
def list_notifications(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List notifications for current user with total unread count."""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )

    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )

    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "category": n.category,
                "is_read": n.is_read,
                "link": n.link,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
    }


@router.patch("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a specific notification as read."""
    n = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")

    n.is_read = True
    db.commit()
    return {"message": "Notification marked as read."}


@router.post("/mark-all-read")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications as read for current user."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a specific notification."""
    n = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")

    db.delete(n)
    db.commit()
    return {"message": "Notification deleted."}


@router.delete("/clear-all")
def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clear all read notifications."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == True,
    ).delete()
    db.commit()
    return {"message": "Cleared all read notifications."}


# ─── NOTIFICATION SETTINGS ───────────────────────────────────────────────────

@router.get("/settings")
def get_notification_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve user notification preferences or instantiate defaults."""
    settings_record = (
        db.query(UserNotificationSettings)
        .filter(UserNotificationSettings.user_id == current_user.id)
        .first()
    )
    if not settings_record:
        settings_record = UserNotificationSettings(
            user_id=current_user.id,
            email_notifications=True,
            login_alerts=True,
            study_reminders=True,
            exam_reminders=True,
            study_plan_reminders=True,
            in_app_notifications=True,
            reminder_minutes_before=15,
            exam_reminder_2days=True,
            exam_reminder_1day=True,
            exam_reminder_day_of=True,
            timezone="Asia/Kolkata",
        )
        db.add(settings_record)
        db.commit()
        db.refresh(settings_record)

    return {
        "email_notifications": settings_record.email_notifications,
        "login_alerts": settings_record.login_alerts,
        "study_reminders": settings_record.study_reminders,
        "exam_reminders": settings_record.exam_reminders,
        "study_plan_reminders": settings_record.study_plan_reminders,
        "in_app_notifications": settings_record.in_app_notifications,
        "reminder_minutes_before": settings_record.reminder_minutes_before,
        "exam_reminder_2days": settings_record.exam_reminder_2days,
        "exam_reminder_1day": settings_record.exam_reminder_1day,
        "exam_reminder_day_of": settings_record.exam_reminder_day_of,
        "timezone": settings_record.timezone,
    }


@router.patch("/settings")
def update_notification_settings(
    payload: NotificationSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user notification preferences."""
    settings_record = (
        db.query(UserNotificationSettings)
        .filter(UserNotificationSettings.user_id == current_user.id)
        .first()
    )
    if not settings_record:
        settings_record = UserNotificationSettings(user_id=current_user.id)
        db.add(settings_record)

    for field, val in payload.dict(exclude_unset=True).items():
        setattr(settings_record, field, val)

    db.commit()
    db.refresh(settings_record)
    return {"message": "Notification preferences updated successfully."}
