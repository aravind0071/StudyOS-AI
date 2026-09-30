"""Quiz router — adaptive quiz generation and submission."""

import logging
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import (
    User, Quiz, QuizQuestion, QuizAttempt, QuizAnswer,
    QuizType, DifficultyLevel, UserConceptMastery, Concept
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quiz", tags=["Quiz"])


class GenerateQuizRequest(BaseModel):
    topics: list[str]
    subject: Optional[str] = None
    difficulty: str = "medium"
    quiz_type: str = "mcq"
    num_questions: int = 10


class SubmitAnswerRequest(BaseModel):
    attempt_id: str
    question_id: str
    user_answer: str


class SubmitQuizRequest(BaseModel):
    attempt_id: str
    answers: list[dict]  # [{question_id, user_answer}]


def _generate_questions_via_llm(
    topics: list[str],
    subject: Optional[str],
    difficulty: str,
    quiz_type: str,
    num_questions: int,
    user_id: str,
    db: Session,
) -> list[dict]:
    """Use LLM to generate quiz questions from user's materials or general knowledge."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Get some context from user's materials
        from app.models.models import MaterialChunk, Material
        context_chunks = (
            db.query(MaterialChunk)
            .join(Material, MaterialChunk.material_id == Material.id)
            .filter(MaterialChunk.user_id == user_id)
            .limit(10)
            .all()
        )
        context = "\n".join(c.content[:300] for c in context_chunks[:5])

        type_instruction = {
            "mcq": "Generate multiple choice questions with 4 options (A, B, C, D). Mark the correct answer.",
            "true_false": "Generate True/False questions.",
            "short_answer": "Generate short answer questions requiring 2-4 sentence answers.",
            "interview": "Generate interview-style questions that test deep understanding.",
        }.get(quiz_type, "Generate multiple choice questions.")

        prompt = f"""Generate {num_questions} {difficulty}-level quiz questions on these topics: {', '.join(topics)}
Subject: {subject or 'General'}
Type: {type_instruction}

{f"Reference material context: {context[:1000]}" if context else ""}

Return a JSON array:
[
  {{
    "question": "Question text here?",
    "options": ["A) Option1", "B) Option2", "C) Option3", "D) Option4"],
    "correct_answer": "A) Option1",
    "explanation": "Brief explanation of why this is correct",
    "topic": "Specific topic from the list",
    "difficulty": "{difficulty}"
  }}
]

For true_false: options should be ["True", "False"]
For short_answer/interview: options should be []
Return ONLY the JSON array."""

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=3000,
        )
        content = response.choices[0].message.content.strip()
        import re
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.error(f"Question generation failed: {e}")

    return []


def _get_fallback_questions(topics: list[str], difficulty: str, quiz_type: str, num_questions: int) -> list[dict]:
    """Provide realistic high-yield quiz questions when LLM is offline or in demo mode."""
    results = []
    default_topics = topics if topics else ["Computer Systems", "Data Structures", "Algorithms"]
    
    for i in range(num_questions):
        topic = default_topics[i % len(default_topics)]
        if quiz_type == "true_false":
            results.append({
                "question": f"In {topic}, resource isolation and security boundaries are enforced by dual-mode execution.",
                "options": ["True", "False"],
                "correct_answer": "True",
                "explanation": f"Dual-mode execution allows the system to protect hardware resources and prevent unintended corruption.",
                "topic": topic,
                "difficulty": difficulty,
            })
        elif quiz_type in ("short_answer", "interview"):
            results.append({
                "question": f"Explain the core mechanisms, performance trade-offs, and scalability implications of {topic}.",
                "options": [],
                "correct_answer": f"Key trade-offs include memory overhead, latency, throughput, and state consistency.",
                "explanation": f"Comprehensive answers evaluate time complexity, space overhead, and edge-case handling.",
                "topic": topic,
                "difficulty": difficulty,
            })
        else:  # mcq
            options = [
                f"A) Provides deterministic latency and optimized memory access patterns",
                f"B) Eliminates all synchronization overhead across threads",
                f"C) Restricts data structures to contiguous static memory",
                f"D) Disables cache coherency protocols automatically",
            ]
            results.append({
                "question": f"Which of the following is the primary design objective or feature of {topic}?",
                "options": options,
                "correct_answer": options[0],
                "explanation": f"{topic} is engineered to optimize throughput and provide deterministic latency guarantees.",
                "topic": topic,
                "difficulty": difficulty,
            })
    return results


from app.services.quiz_engine import generate_adaptive_quiz_questions


@router.post("/generate")
def generate_quiz(
    payload: GenerateQuizRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a new adaptive quiz from the student's materials and curriculum."""
    questions_data = generate_adaptive_quiz_questions(
        topics=payload.topics,
        subject=payload.subject,
        difficulty=payload.difficulty,
        quiz_type=payload.quiz_type,
        num_questions=payload.num_questions,
        user_id=str(current_user.id),
        db=db,
    )

    # Create quiz record
    diff_map = {"easy": DifficultyLevel.EASY, "medium": DifficultyLevel.MEDIUM, "hard": DifficultyLevel.HARD}
    type_map = {"mcq": QuizType.MCQ, "true_false": QuizType.TRUE_FALSE, "short_answer": QuizType.SHORT_ANSWER, "interview": QuizType.INTERVIEW}

    quiz = Quiz(
        user_id=current_user.id,
        title=f"{payload.subject or 'General'} — {', '.join(payload.topics[:2])} Quiz",
        subject=payload.subject,
        topics=payload.topics,
        difficulty=diff_map.get(payload.difficulty, DifficultyLevel.MEDIUM),
        quiz_type=type_map.get(payload.quiz_type, QuizType.MCQ),
        total_questions=len(questions_data),
    )
    db.add(quiz)
    db.flush()

    # Create question records
    question_records = []
    for q_data in questions_data:
        question = QuizQuestion(
            quiz_id=quiz.id,
            user_id=current_user.id,
            question_text=q_data.get("question", ""),
            question_type=type_map.get(payload.quiz_type, QuizType.MCQ),
            options=q_data.get("options", []),
            correct_answer=q_data.get("correct_answer", ""),
            explanation=q_data.get("explanation", ""),
            topic=q_data.get("topic", payload.topics[0] if payload.topics else ""),
            difficulty=diff_map.get(q_data.get("difficulty", payload.difficulty), DifficultyLevel.MEDIUM),
        )
        db.add(question)
        question_records.append(question)

    db.commit()

    return {
        "quiz_id": str(quiz.id),
        "title": quiz.title,
        "total_questions": len(questions_data),
        "questions": [
            {
                "id": str(q.id),
                "question": q.question_text,
                "options": q.options,
                "topic": q.topic,
                "difficulty": q.difficulty.value,
                "type": q.question_type.value,
            }
            for q in question_records
        ],
    }


@router.post("/start/{quiz_id}")
def start_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new attempt for a quiz."""
    quiz = (
        db.query(Quiz)
        .filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    attempt = QuizAttempt(
        user_id=current_user.id,
        quiz_id=quiz.id,
        total_questions=quiz.total_questions,
    )
    db.add(attempt)
    db.commit()

    return {"attempt_id": str(attempt.id), "quiz_id": str(quiz.id)}


@router.post("/submit")
def submit_quiz(
    payload: SubmitQuizRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit quiz answers, evaluate, update mastery scores."""
    attempt = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.id == payload.attempt_id, QuizAttempt.user_id == current_user.id)
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found.")

    quiz = db.query(Quiz).filter(Quiz.id == attempt.quiz_id).first()
    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).all()
    question_map = {str(q.id): q for q in questions}

    correct = 0
    wrong = 0
    topic_performance: dict[str, dict] = {}

    for answer_data in payload.answers:
        q_id = answer_data.get("question_id")
        user_ans = answer_data.get("user_answer", "")
        question = question_map.get(q_id)
        if not question:
            continue

        is_correct = user_ans.strip().lower() == question.correct_answer.strip().lower()
        if is_correct:
            correct += 1
        else:
            wrong += 1

        answer = QuizAnswer(
            attempt_id=attempt.id,
            question_id=question.id,
            user_answer=user_ans,
            is_correct=is_correct,
        )
        db.add(answer)

        # Track per-topic performance
        topic = question.topic or "General"
        if topic not in topic_performance:
            topic_performance[topic] = {"correct": 0, "total": 0}
        topic_performance[topic]["total"] += 1
        if is_correct:
            topic_performance[topic]["correct"] += 1

    # Update attempt
    from datetime import datetime, timezone
    attempt.correct_count = correct
    attempt.wrong_count = wrong
    attempt.score = (correct / max(attempt.total_questions, 1)) * 100
    attempt.completed_at = datetime.now(timezone.utc)

    # Update concept mastery for each topic
    for topic, perf in topic_performance.items():
        concept = (
            db.query(Concept)
            .filter(Concept.user_id == current_user.id, Concept.name == topic)
            .first()
        )
        if concept:
            mastery = (
                db.query(UserConceptMastery)
                .filter(
                    UserConceptMastery.user_id == current_user.id,
                    UserConceptMastery.concept_id == concept.id,
                )
                .first()
            )
            if not mastery:
                mastery = UserConceptMastery(user_id=current_user.id, concept_id=concept.id)
                db.add(mastery)

            # Weighted moving average for mastery score
            quiz_score = (perf["correct"] / max(perf["total"], 1)) * 100
            if mastery.quiz_attempts_count == 0:
                mastery.mastery_score = quiz_score
            else:
                # Weight recent performance more (70% new, 30% historical)
                mastery.mastery_score = 0.7 * quiz_score + 0.3 * mastery.mastery_score

            mastery.quiz_attempts_count += 1
            mastery.correct_answers += perf["correct"]
            mastery.wrong_answers += perf["total"] - perf["correct"]
            mastery.last_revised_at = datetime.now(timezone.utc)

    db.commit()

    # Build weak topics list
    weak_topics = [t for t, p in topic_performance.items() if p["correct"] / max(p["total"], 1) < 0.6]

    return {
        "attempt_id": str(attempt.id),
        "score": attempt.score,
        "correct": correct,
        "wrong": wrong,
        "total": attempt.total_questions,
        "topic_performance": {
            t: {
                "correct": p["correct"],
                "total": p["total"],
                "percentage": round((p["correct"] / max(p["total"], 1)) * 100, 1),
            }
            for t, p in topic_performance.items()
        },
        "weak_topics": weak_topics,
        "message": f"You scored {attempt.score:.0f}%. {'Great job!' if attempt.score >= 70 else 'Keep practising!' if attempt.score >= 50 else 'Review these topics and try again.'}",
    }


@router.get("/history")
def quiz_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attempts = (
        db.query(QuizAttempt, Quiz)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .filter(QuizAttempt.user_id == current_user.id, QuizAttempt.completed_at != None)
        .order_by(QuizAttempt.completed_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "attempt_id": str(a.id),
            "quiz_title": q.title,
            "score": a.score,
            "correct": a.correct_count,
            "total": a.total_questions,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        }
        for a, q in attempts
    ]
