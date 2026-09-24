"""Interview mode router."""

import logging
import json
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User, InterviewSession, InterviewQuestion, DifficultyLevel

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


FALLBACK_QUESTIONS_BY_TOPIC = {
    "Python": [
        "Explain the key differences between mutable and immutable data types in Python with practical examples.",
        "How does Python manage memory internally (reference counting, cyclic garbage collection, and GIL)?",
        "What are Python generators and decorators? How does the 'yield' keyword differ from 'return' under the hood?",
        "Explain multiple inheritance and the C3 linearization (Method Resolution Order / MRO) algorithm in Python.",
        "What is the Global Interpreter Lock (GIL) in CPython, and how do multi-threading and multi-processing compare?",
        "How do context managers work in Python, and how would you implement a custom one using '__enter__' and '__exit__'?",
        "Explain the difference between deepcopy and shallow copy in Python, and how they behave with nested structures.",
        "What are Python metaclasses and dunder methods ('__new__' vs '__init__'), and when should you use them?",
        "How does Python's asyncio event loop execute coroutines concurrently on a single thread?",
        "How would you profile, identify, and fix a memory leak or CPU bottleneck in a high-throughput Python backend?"
    ],
    "Operating Systems": [
        "Explain the difference between a process and a thread, and how process context switching operates.",
        "What are the four necessary conditions for deadlocks, and how can the Coffman conditions be prevented or detected?",
        "Explain virtual memory, demand paging, and the differences between page faults and segmentation faults.",
        "Compare CPU scheduling algorithms: Round Robin, Multi-Level Feedback Queue, and Shortest Job First.",
        "How do mutexes, semaphores, and spinlocks differ, and what is the priority inversion problem?",
        "What is thrashing in operating systems, and how does the working set model resolve it?",
        "Explain inter-process communication (IPC) mechanisms: shared memory, message queues, sockets, and pipes.",
        "How do modern file systems implement journaling and inodes for crash consistency?",
        "Explain how memory protection and user/kernel mode transitions (syscalls, interrupts, traps) are implemented.",
        "How would you design a distributed lock service taking clock drift and network partitions into account?"
    ],
    "DBMS": [
        "Explain ACID properties in relational databases and the mechanisms used to guarantee each of them.",
        "What are database indexes (B-Tree vs Hash Index), and how do they impact read and write performance?",
        "Walk through database normalization from 1NF to BCNF with a concrete relational schema example.",
        "What are transaction isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable) and their trade-offs?",
        "Explain the Two-Phase Locking (2PL) protocol and how it ensures serializability.",
        "Compare SQL (relational) vs NoSQL (document, key-value, column-family) databases and when to choose each.",
        "How does Write-Ahead Logging (WAL) ensure durability and atomic recovery in database engines?",
        "Explain database sharding, replication (master-slave vs multi-master), and partition tolerance.",
        "What are clustered vs non-clustered indexes, and how do composite indexes behave with prefix matching?",
        "How would you diagnose and optimize a slow query involving multi-table joins on millions of rows?"
    ],
    "Data Structures & Algorithms": [
        "Explain how a Hash Table handles hash collisions (chaining vs open addressing) and its worst-case complexity.",
        "How does QuickSort work, why is its worst case O(n^2), and how can median-of-three pivot selection mitigate it?",
        "Compare Breadth-First Search (BFS) and Depth-First Search (DFS) in graph traversal and their cycle detection use cases.",
        "Explain Dijkstra's shortest path algorithm and how using a min-heap optimizes its time complexity.",
        "What is Dynamic Programming? Explain the difference between top-down memoization and bottom-up tabulation.",
        "How does a Red-Black Tree maintain self-balancing properties during insertions and deletions?",
        "Explain the Trie data structure and its advantages for prefix matching and autocomplete engines.",
        "What is the topological sort algorithm, and how is it used to resolve build dependencies in a DAG?",
        "How do Disjoint Set Union (Union-Find) with path compression and rank optimization achieve nearly O(1) operations?",
        "How would you find the median of an infinite data stream using two priority queues (min-heap and max-heap)?"
    ],
    "Computer Networks": [
        "Walk through the TCP 3-way handshake and 4-way teardown processes with TCP packet flags.",
        "Explain the differences between TCP and UDP, and why real-time streaming often prefers UDP.",
        "What happens under the hood from the moment you type a URL into your browser until the web page renders?",
        "Explain DNS resolution hierarchy (root, TLD, authoritative nameservers) and recursive vs iterative queries.",
        "How does subnetting and CIDR notation work, and how does a router determine the next hop via routing tables?",
        "Explain the OSI 7-layer model vs the TCP/IP 4-layer model and where common protocols operate.",
        "What is HTTP/2 multiplexing and HTTP/3 QUIC, and how do they solve head-of-line blocking in HTTP/1.1?",
        "How does NAT (Network Address Translation) and port forwarding enable private IP addresses to communicate on the Internet?",
        "Explain SSL/TLS handshake, asymmetric vs symmetric encryption, and digital certificates.",
        "How do CDN edge networks and anycast routing accelerate content delivery and mitigate DDoS attacks?"
    ]
}


def _generate_interview_question(
    topic: str,
    question_order: int,
    previous_questions: list[str],
    difficulty: str,
    project_desc: Optional[str] = None,
) -> dict:
    """Generate next interview question using LLM with progressive fallback."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        prev_q_text = "\n".join(f"- {q}" for q in previous_questions[-3:])
        project_ctx = f"\nProject: {project_desc}" if project_desc else ""

        prompt = f"""You are a technical interviewer conducting a {difficulty}-level interview on {topic}.{project_ctx}

Previous questions asked:
{prev_q_text if prev_q_text else "None yet"}

Generate question #{question_order + 1} that:
- Is {difficulty} difficulty
- Progresses logically from previous questions
- Tests deep understanding, not just memorization
- For question 1-3: fundamentals; 4-6: intermediate; 7+: advanced/design

Return JSON:
{{"question": "Your question here?", "expected_points": ["point1", "point2", "point3"]}}"""

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=500,
        )
        content = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.error(f"Interview question generation failed: {e}")

    # Fallback to progressive curated questions
    for key, q_list in FALLBACK_QUESTIONS_BY_TOPIC.items():
        if key.lower() in topic.lower() or topic.lower() in key.lower():
            idx = question_order % len(q_list)
            return {"question": q_list[idx], "expected_points": []}

    return {"question": f"Explain the core architectural principles and internal design of {topic}.", "expected_points": []}


def _evaluate_answer(question: str, user_answer: str, expected_points: list[str], topic: str) -> dict:
    """Evaluate interview answer using LLM."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        prompt = f"""Evaluate this interview answer for the topic: {topic}

Question: {question}
Expected key points: {', '.join(expected_points)}
Candidate's answer: {user_answer}

Rate on 0-100 scale:
- Technical correctness (0-100)
- Completeness (0-100)
- Clarity (0-100)

Return JSON:
{{
  "correctness_score": 75,
  "depth_score": 60,
  "clarity_score": 80,
  "feedback": "Brief constructive feedback (2-3 sentences)",
  "missing_points": ["point missed 1", "point missed 2"],
  "follow_up_question": "A natural follow-up question?"
}}"""

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=600,
        )
        content = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.error(f"Answer evaluation failed: {e}")

    return {
        "correctness_score": 50,
        "depth_score": 50,
        "clarity_score": 50,
        "feedback": "Could not evaluate answer automatically.",
        "missing_points": [],
        "follow_up_question": None,
    }


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

    # Generate first question
    q_data = _generate_interview_question(
        topic=payload.topic,
        question_order=0,
        previous_questions=[],
        difficulty="easy",
        project_desc=payload.project_description,
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
        "first_question": {
            "id": str(question.id),
            "question": question.question_text,
            "order": 0,
            "difficulty": "easy",
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

    # Evaluate answer
    evaluation = _evaluate_answer(
        question=question.question_text,
        user_answer=payload.user_answer,
        expected_points=[],
        topic=session.topic,
    )

    question.user_answer = payload.user_answer
    question.ai_feedback = evaluation.get("feedback")
    question.correctness_score = evaluation.get("correctness_score")
    question.depth_score = evaluation.get("depth_score")
    question.clarity_score = evaluation.get("clarity_score")
    question.follow_up_question = evaluation.get("follow_up_question")
    session.total_questions = question.question_order + 1

    db.flush()

    # Generate next question (if session not ended)
    next_question = None
    if question.question_order < 9:  # max 10 questions
        prev_questions = [q.question_text for q in session.questions]
        next_q_order = question.question_order + 1
        difficulty = "easy" if next_q_order < 3 else "medium" if next_q_order < 7 else "hard"
        diff_map = {"easy": DifficultyLevel.EASY, "medium": DifficultyLevel.MEDIUM, "hard": DifficultyLevel.HARD}

        next_q_data = _generate_interview_question(
            topic=session.topic,
            question_order=next_q_order,
            previous_questions=prev_questions,
            difficulty=difficulty,
            project_desc=session.project_description,
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
        next_question = {"id": str(next_q.id), "question": next_q.question_text, "order": next_q_order, "difficulty": difficulty}
    else:
        session.completed = True

    db.commit()

    return {
        "feedback": evaluation.get("feedback"),
        "correctness_score": evaluation.get("correctness_score"),
        "depth_score": evaluation.get("depth_score"),
        "clarity_score": evaluation.get("clarity_score"),
        "missing_points": evaluation.get("missing_points", []),
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

    question.user_answer = "[Candidate skipped question]"
    question.ai_feedback = "This question was skipped by the candidate."
    question.correctness_score = 0
    question.depth_score = 0
    question.clarity_score = 0
    session.total_questions = question.question_order + 1
    db.flush()

    # Generate next question
    next_question = None
    if question.question_order < 9:
        prev_questions = [q.question_text for q in session.questions]
        next_q_order = question.question_order + 1
        difficulty = "easy" if next_q_order < 3 else "medium" if next_q_order < 7 else "hard"
        diff_map = {"easy": DifficultyLevel.EASY, "medium": DifficultyLevel.MEDIUM, "hard": DifficultyLevel.HARD}

        next_q_data = _generate_interview_question(
            topic=session.topic,
            question_order=next_q_order,
            previous_questions=prev_questions,
            difficulty=difficulty,
            project_desc=session.project_description,
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
        next_question = {"id": str(next_q.id), "question": next_q.question_text, "order": next_q_order, "difficulty": difficulty}
    else:
        session.completed = True

    db.commit()

    return {
        "message": "Question skipped.",
        "feedback": "Question was skipped.",
        "correctness_score": 0,
        "depth_score": 0,
        "clarity_score": 0,
        "missing_points": ["Candidate chose to skip this topic."],
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

    # Check if this question order already exists in database
    existing_q = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.session_id == session.id, InterviewQuestion.question_order == next_order)
        .first()
    )
    if existing_q:
        diff_str = "easy" if existing_q.difficulty == DifficultyLevel.EASY else "medium" if existing_q.difficulty == DifficultyLevel.MEDIUM else "hard"
        return {
            "next_question": {
                "id": str(existing_q.id),
                "question": existing_q.question_text,
                "order": existing_q.question_order,
                "difficulty": diff_str,
            },
            "session_complete": False,
        }

    # Generate new question
    prev_questions = [q.question_text for q in session.questions]
    difficulty = "easy" if next_order < 3 else "medium" if next_order < 7 else "hard"
    diff_map = {"easy": DifficultyLevel.EASY, "medium": DifficultyLevel.MEDIUM, "hard": DifficultyLevel.HARD}

    next_q_data = _generate_interview_question(
        topic=session.topic,
        question_order=next_order,
        previous_questions=prev_questions,
        difficulty=difficulty,
        project_desc=session.project_description,
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
        },
        "session_complete": False,
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
