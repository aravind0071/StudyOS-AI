from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func


from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import (
    User, QuizAttempt, Quiz, UserConceptMastery, Concept,
    Material, StudyTask, ChatMessage
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
def get_analytics_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Comprehensive analytics overview for the student dashboard."""

    # Quiz stats
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id, QuizAttempt.completed_at != None)
        .all()
    )
    avg_score = sum(a.score for a in attempts if a.score) / max(len(attempts), 1)
    total_questions = sum(a.total_questions for a in attempts)
    total_correct = sum(a.correct_count for a in attempts)

    # Concept mastery
    masteries = (
        db.query(UserConceptMastery, Concept)
        .join(Concept, UserConceptMastery.concept_id == Concept.id)
        .filter(UserConceptMastery.user_id == current_user.id)
        .all()
    )
    mastery_data = [
        {"concept": c.name, "score": round(m.mastery_score, 1)}
        for m, c in masteries
    ]
    mastery_data.sort(key=lambda x: x["score"])

    weak_concepts = [m for m in mastery_data if m["score"] < 60]
    strong_concepts = [m for m in mastery_data if m["score"] >= 80]

    # Materials
    material_count = db.query(func.count(Material.id)).filter(
        Material.user_id == current_user.id
    ).scalar()

    # Study tasks completed
    completed_tasks = db.query(func.count(StudyTask.id)).filter(
        StudyTask.user_id == current_user.id,
        StudyTask.is_completed == True,
    ).scalar()

    # Knowledge score (weighted average of all mastery scores)
    knowledge_score = (
        sum(m["score"] for m in mastery_data) / max(len(mastery_data), 1)
        if mastery_data else 0
    )

    # Exam readiness calculation
    if attempts and mastery_data:
        exam_readiness = (knowledge_score * 0.6) + (avg_score * 0.4)
    elif mastery_data:
        exam_readiness = knowledge_score
    elif attempts:
        exam_readiness = avg_score
    else:
        exam_readiness = 0.0

    # Study streak: count distinct active days from quiz attempts and task completions
    activity_dates = set()
    for a in attempts:
        if a.completed_at:
            activity_dates.add(a.completed_at.date())
    streak = len(activity_dates) if activity_dates else (1 if (material_count and material_count > 0) else 0)

    return {
        "knowledge_score": round(knowledge_score, 1),
        "exam_readiness": round(exam_readiness, 1),
        "quiz_accuracy": round(avg_score, 1),
        "total_quizzes": len(attempts),
        "total_questions_attempted": total_questions,
        "total_correct": total_correct,
        "material_count": material_count,
        "completed_tasks": completed_tasks,
        "study_streak": streak,
        "weak_concepts": weak_concepts[:5],
        "strong_concepts": strong_concepts[-5:],
        "all_mastery": mastery_data,
        "recent_quiz_scores": [
            {"score": a.score, "date": a.completed_at.isoformat() if a.completed_at else None}
            for a in sorted(attempts, key=lambda x: x.completed_at or datetime.min, reverse=True)[:7]
        ],
    }
