"""Interview mode router with adaptive 10-stage questioning, duplicate rejection, and 5-dimensional scoring."""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User, InterviewSession, InterviewQuestion, DifficultyLevel
from app.services.interview_engine import (
    generate_interview_question,
    evaluate_interview_answer,
    STAGE_NAMES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/interview", tags=["Interview Mode"])

TOPICS = [
    "Python", "Java", "C++", "DBMS", "Operating Systems",
    "Computer Networks", "Machine Learning", "Data Science",
    "Data Structures & Algorithms", "System Design", "Project Viva",
]


class StartSessionRequest(BaseModel):
    topic: str
    mode: str = "technical"  # "technical" or "project_viva"
    project_description: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    user_answer: str


class NextQuestionRequest(BaseModel):
    session_id: str
    current_question_order: int


@router.post("/start")
def start_session(
    payload: StartSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = InterviewSession(
        user_id=current_user.id,
        topic=payload.topic,
        mode=payload.mode,
        project_description=payload.project_description,
    )
    db.add(session)
    db.flush()

    # Generate first question (Stage 0: Basic Concept)
    q_data = generate_interview_question(
        topic=payload.topic,
        question_order=0,
        previous_questions=[],
        difficulty="easy",
        project_desc=payload.project_description,
        mode=payload.mode,
    )

    question = InterviewQuestion(
        session_id=session.id,
        user_id=current_user.id,
        question_text=q_data["question"],
        question_order=0,
        difficulty=DifficultyLevel.EASY,
    )
    db.add(question)
    db.commit()

    return {
        "session_id": str(session.id),
        "topic": session.topic,
        "mode": session.mode,
        "first_question": {
            "id": str(question.id),
            "question": question.question_text,
            "order": 0,
            "difficulty": "easy",
            "stage": q_data.get("stage", STAGE_NAMES[0]),
        },
    }


@router.post("/answer")
def submit_answer(
    payload: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == payload.session_id, InterviewSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    question = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.id == payload.question_id, InterviewQuestion.session_id == session.id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Rigorous 5-dimensional evaluation
    evaluation = evaluate_interview_answer(
        question=question.question_text,
        user_answer=payload.user_answer,
        topic=session.topic,
        stage_idx=question.question_order,
    )

    question.user_answer = payload.user_answer
    question.ai_feedback = evaluation.get("feedback")
    question.correctness_score = evaluation.get("correctness_score")
    question.relevance_score = evaluation.get("relevance_score")
    question.depth_score = evaluation.get("depth_score")
    question.completeness_score = evaluation.get("completeness_score")
    question.communication_score = evaluation.get("communication_score")
    question.clarity_score = evaluation.get("communication_score")
    question.overall_score = evaluation.get("overall_score")
    question.follow_up_question = evaluation.get("follow_up_question")
    question.is_skipped = False
    session.total_questions = question.question_order + 1

    db.flush()

    # Generate next question with real interviewer adaptability (if not at question 10)
    next_question = None
    if question.question_order < 9:
        prev_questions = [q.question_text for q in session.questions if q.question_text]
        next_q_order = question.question_order + 1
        difficulty = "easy" if next_q_order < 3 else "medium" if next_q_order < 7 else "hard"
        diff_map = {"easy": DifficultyLevel.EASY, "medium": DifficultyLevel.MEDIUM, "hard": DifficultyLevel.HARD}

        next_q_data = generate_interview_question(
            topic=session.topic,
            question_order=next_q_order,
            previous_questions=prev_questions,
            difficulty=difficulty,
            project_desc=session.project_description,
            mode=session.mode,
            last_answer=payload.user_answer,
            last_score=evaluation.get("overall_score"),
        )
        next_q = InterviewQuestion(
            session_id=session.id,
            user_id=current_user.id,
            question_text=next_q_data["question"],
            question_order=next_q_order,
            difficulty=diff_map[difficulty],
        )
        db.add(next_q)
        db.flush()
        next_question = {
            "id": str(next_q.id),
            "question": next_q.question_text,
            "order": next_q_order,
            "difficulty": difficulty,
            "stage": next_q_data.get("stage", STAGE_NAMES[next_q_order]),
        }
    else:
        session.completed = True

    db.commit()

    return {
        "feedback": evaluation.get("feedback"),
        "correctness_score": evaluation.get("correctness_score"),
        "relevance_score": evaluation.get("relevance_score"),
        "depth_score": evaluation.get("depth_score"),
        "completeness_score": evaluation.get("completeness_score"),
        "communication_score": evaluation.get("communication_score"),
        "overall_score": evaluation.get("overall_score"),
        "missing_points": evaluation.get("missing_points", []),
        "follow_up_question": evaluation.get("follow_up_question"),
        "next_question": next_question,
        "session_complete": session.completed,
    }


@router.post("/skip")
def skip_question(
    payload: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == payload.session_id, InterviewSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    question = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.id == payload.question_id, InterviewQuestion.session_id == session.id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Mark explicitly as skipped
    question.user_answer = "[Candidate skipped question]"
    question.ai_feedback = "This question was skipped by the candidate."
    question.correctness_score = 0.0
    question.relevance_score = 0.0
    question.depth_score = 0.0
    question.completeness_score = 0.0
    question.communication_score = 0.0
    question.clarity_score = 0.0
    question.overall_score = 0.0
    question.is_skipped = True
    session.total_questions = question.question_order + 1
    db.flush()

    # Generate next question
    next_question = None
    if question.question_order < 9:
        prev_questions = [q.question_text for q in session.questions if q.question_text]
        next_q_order = question.question_order + 1
        difficulty = "easy" if next_q_order < 3 else "medium" if next_q_order < 7 else "hard"
        diff_map = {"easy": DifficultyLevel.EASY, "medium": DifficultyLevel.MEDIUM, "hard": DifficultyLevel.HARD}

        next_q_data = generate_interview_question(
            topic=session.topic,
            question_order=next_q_order,
            previous_questions=prev_questions,
            difficulty=difficulty,
            project_desc=session.project_description,
            mode=session.mode,
            last_answer=None,
            last_score=None,
        )
        next_q = InterviewQuestion(
            session_id=session.id,
            user_id=current_user.id,
            question_text=next_q_data["question"],
            question_order=next_q_order,
            difficulty=diff_map[difficulty],
        )
        db.add(next_q)
        db.flush()
        next_question = {
            "id": str(next_q.id),
            "question": next_q.question_text,
            "order": next_q_order,
            "difficulty": difficulty,
            "stage": next_q_data.get("stage", STAGE_NAMES[next_q_order]),
        }
    else:
        session.completed = True

    db.commit()

    return {
        "message": "Question skipped.",
        "feedback": "This question was skipped.",
        "correctness_score": 0.0,
        "relevance_score": 0.0,
        "depth_score": 0.0,
        "completeness_score": 0.0,
        "communication_score": 0.0,
        "overall_score": 0.0,
        "missing_points": ["Question was skipped by candidate."],
        "is_skipped": True,
        "next_question": next_question,
        "session_complete": session.completed,
    }


@router.post("/next-question")
def get_or_generate_next_question(
    payload: NextQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == payload.session_id, InterviewSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    next_order = payload.current_question_order + 1
    if next_order >= 10:
        return {"next_question": None, "session_complete": True}

    # Check if question already exists in DB
    existing_q = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.session_id == session.id, InterviewQuestion.question_order == next_order)
        .first()
    )
    if existing_q:
        diff_str = "easy" if existing_q.difficulty == DifficultyLevel.EASY else "medium" if existing_q.difficulty == DifficultyLevel.MEDIUM else "hard"
        stage_name = STAGE_NAMES[min(next_order, 9)]
        return {
            "next_question": {
                "id": str(existing_q.id),
                "question": existing_q.question_text,
                "order": existing_q.question_order,
                "difficulty": diff_str,
                "stage": stage_name,
            },
            "session_complete": False,
        }

    # Generate new question
    prev_questions = [q.question_text for q in session.questions if q.question_text]
    difficulty = "easy" if next_order < 3 else "medium" if next_order < 7 else "hard"
    diff_map = {"easy": DifficultyLevel.EASY, "medium": DifficultyLevel.MEDIUM, "hard": DifficultyLevel.HARD}

    next_q_data = generate_interview_question(
        topic=session.topic,
        question_order=next_order,
        previous_questions=prev_questions,
        difficulty=difficulty,
        project_desc=session.project_description,
        mode=session.mode,
    )
    new_q = InterviewQuestion(
        session_id=session.id,
        user_id=current_user.id,
        question_text=next_q_data["question"],
        question_order=next_order,
        difficulty=diff_map[difficulty],
    )
    db.add(new_q)
    db.commit()

    return {
        "next_question": {
            "id": str(new_q.id),
            "question": new_q.question_text,
            "order": new_q.question_order,
            "difficulty": difficulty,
            "stage": next_q_data.get("stage", STAGE_NAMES[next_order]),
        },
        "session_complete": False,
    }


@router.get("/summary/{session_id}")
def get_session_summary(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns comprehensive analytics for an interview session."""
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    questions = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.session_id == session.id)
        .order_by(InterviewQuestion.question_order.asc())
        .all()
    )

    submitted_questions = [
        q for q in questions
        if not getattr(q, "is_skipped", False)
        and q.user_answer
        and q.user_answer != "[Candidate skipped question]"
    ]
    skipped_count = sum(1 for q in questions if getattr(q, "is_skipped", False) or q.user_answer == "[Candidate skipped question]")
    submitted_count = len(submitted_questions)

    # Calculate average ONLY from submitted answers
    if submitted_count > 0:
        avg_overall = round(sum(q.overall_score or q.correctness_score or 0 for q in submitted_questions) / submitted_count)
        avg_correctness = round(sum(q.correctness_score or 0 for q in submitted_questions) / submitted_count)
        avg_relevance = round(sum(q.relevance_score or q.correctness_score or 0 for q in submitted_questions) / submitted_count)
        avg_depth = round(sum(q.depth_score or 0 for q in submitted_questions) / submitted_count)
        avg_completeness = round(sum(q.completeness_score or q.depth_score or 0 for q in submitted_questions) / submitted_count)
        avg_communication = round(sum(q.communication_score or q.clarity_score or 0 for q in submitted_questions) / submitted_count)
    else:
        avg_overall = 0
        avg_correctness = 0
        avg_relevance = 0
        avg_depth = 0
        avg_completeness = 0
        avg_communication = 0

    return {
        "session_id": str(session.id),
        "topic": session.topic,
        "mode": session.mode,
        "completed": session.completed,
        "total_questions_presented": len(questions),
        "submitted_count": submitted_count,
        "skipped_count": skipped_count,
        "average_overall_score": avg_overall,
        "scores_breakdown": {
            "correctness": avg_correctness,
            "relevance": avg_relevance,
            "depth": avg_depth,
            "completeness": avg_completeness,
            "communication": avg_communication,
        },
        "questions": [
            {
                "id": str(q.id),
                "order": q.question_order,
                "question": q.question_text,
                "user_answer": q.user_answer,
                "ai_feedback": q.ai_feedback,
                "is_skipped": getattr(q, "is_skipped", False) or q.user_answer == "[Candidate skipped question]",
                "correctness_score": q.correctness_score,
                "relevance_score": getattr(q, "relevance_score", q.correctness_score),
                "depth_score": q.depth_score,
                "completeness_score": getattr(q, "completeness_score", q.depth_score),
                "communication_score": getattr(q, "communication_score", q.clarity_score),
                "overall_score": getattr(q, "overall_score", q.correctness_score),
            }
            for q in questions
        ]
    }


@router.get("/sessions")
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == current_user.id)
        .order_by(InterviewSession.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": str(s.id),
            "topic": s.topic,
            "mode": s.mode,
            "total_questions": s.total_questions,
            "completed": s.completed,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]
