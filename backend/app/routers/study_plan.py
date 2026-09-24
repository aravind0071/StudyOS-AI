"""Study plan and interview routers — stub implementations."""

from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User, StudyPlan, StudyTask, UserConceptMastery, Concept

router = APIRouter(prefix="/study-plan", tags=["Study Plan"])


class GeneratePlanRequest(BaseModel):
    subject: Optional[str] = None
    exam_date: Optional[str] = None  # ISO date string
    topics: Optional[list[str]] = None


@router.post("/generate")
def generate_study_plan(
    payload: GeneratePlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a personalized study plan based on mastery scores and exam date."""

    # Get weak concepts (mastery < 70%)
    masteries = (
        db.query(UserConceptMastery, Concept)
        .join(Concept, UserConceptMastery.concept_id == Concept.id)
        .filter(
            UserConceptMastery.user_id == current_user.id,
            UserConceptMastery.mastery_score < 70,
        )
        .order_by(UserConceptMastery.mastery_score.asc())
        .all()
    )

    # Calculate days until exam
    days_available = 7  # default
    exam_date_obj = None
    if payload.exam_date:
        try:
            exam_date_obj = datetime.fromisoformat(payload.exam_date)
            if exam_date_obj.tzinfo is None:
                exam_date_obj = exam_date_obj.replace(tzinfo=timezone.utc)
            days_available = max(1, (exam_date_obj - datetime.now(timezone.utc)).days)
        except Exception:
            pass

    # Deactivate existing plans
    existing_plans = db.query(StudyPlan).filter(
        StudyPlan.user_id == current_user.id, StudyPlan.is_active == True
    ).all()
    for plan in existing_plans:
        plan.is_active = False

    # Create new plan
    plan = StudyPlan(
        user_id=current_user.id,
        title=f"{payload.subject or 'Study'} Plan — {days_available} days",
        subject=payload.subject,
        exam_date=exam_date_obj,
        is_active=True,
    )
    db.add(plan)
    db.flush()

    tasks_created = []
    today = datetime.now(timezone.utc)

    # Prioritize weak concepts
    weak_topics = [(m.mastery_score, c.name) for m, c in masteries]

    # Fill plan days
    for day in range(1, min(days_available + 1, 15)):
        scheduled = today + timedelta(days=day - 1)

        if weak_topics:
            score, topic = weak_topics[(day - 1) % len(weak_topics)]
            activity = "Review & Practice"
            duration = 45 if score < 40 else 30
            reason = f"Estimated mastery is {score:.0f}%, which needs improvement."
            priority = 1 if score < 40 else 2
        else:
            topic = payload.topics[day % len(payload.topics)] if payload.topics else "General Revision"
            activity = "Revision"
            duration = 30
            reason = "Scheduled for regular revision."
            priority = 2

        # Add quiz day every 3rd day
        if day % 3 == 0:
            quiz_task = StudyTask(
                plan_id=plan.id,
                user_id=current_user.id,
                day_number=day,
                scheduled_date=scheduled,
                topic="Mock Quiz",
                activity="Take adaptive quiz on recent topics",
                duration_minutes=30,
                priority=1,
                reason="Regular assessment improves retention.",
            )
            db.add(quiz_task)
            tasks_created.append(quiz_task)

        task = StudyTask(
            plan_id=plan.id,
            user_id=current_user.id,
            day_number=day,
            scheduled_date=scheduled,
            topic=topic,
            activity=activity,
            duration_minutes=duration,
            priority=priority,
            reason=reason,
        )
        db.add(task)
        tasks_created.append(task)

    db.commit()

    return {
        "plan_id": str(plan.id),
        "title": plan.title,
        "days": days_available,
        "tasks": [
            {
                "id": str(t.id),
                "day": t.day_number,
                "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
                "topic": t.topic,
                "activity": t.activity,
                "duration_minutes": t.duration_minutes,
                "priority": t.priority,
                "reason": t.reason,
                "is_completed": t.is_completed,
            }
            for t in tasks_created
        ],
    }


@router.get("/active")
def get_active_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == current_user.id, StudyPlan.is_active == True)
        .first()
    )
    if not plan:
        return {"plan": None}

    tasks = db.query(StudyTask).filter(StudyTask.plan_id == plan.id).order_by(StudyTask.day_number, StudyTask.priority).all()

    return {
        "plan": {
            "id": str(plan.id),
            "title": plan.title,
            "exam_date": plan.exam_date.isoformat() if plan.exam_date else None,
            "tasks": [
                {
                    "id": str(t.id),
                    "day": t.day_number,
                    "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
                    "topic": t.topic,
                    "activity": t.activity,
                    "duration_minutes": t.duration_minutes,
                    "priority": t.priority,
                    "reason": t.reason,
                    "is_completed": t.is_completed,
                }
                for t in tasks
            ],
        }
    }


@router.patch("/task/{task_id}")
def update_task(
    task_id: str,
    is_completed: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(StudyTask)
        .filter(StudyTask.id == task_id, StudyTask.user_id == current_user.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    task.is_completed = is_completed
    if is_completed:
        task.completed_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Task updated.", "is_completed": task.is_completed}
