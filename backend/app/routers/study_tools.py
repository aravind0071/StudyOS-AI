"""
Study Tools Router — StudyOS AI
Endpoints for:
1. Revision Notes (/study-tools/revision-notes)
2. Exam Notes (/study-tools/exam-notes)
3. Study Pack (/study-tools/study-pack)
4. Model Paper Extraction & Solver (/study-tools/model-paper/...)
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User
from app.services.study_tools_service import (
    generate_revision_notes_service,
    generate_exam_notes_service,
    generate_study_pack_service,
    extract_text_from_file_bytes,
    parse_questions_from_text,
    answer_model_paper_question,
)

router = APIRouter(prefix="/study-tools", tags=["Study Tools"])


# ── Pydantic Request Models ──────────────────────────────────────────────────

class RevisionNotesRequest(BaseModel):
    topic: str
    subject: Optional[str] = None
    unit: Optional[str] = None
    material_id: Optional[str] = None


class ExamNotesRequest(BaseModel):
    topic: str
    marks: Optional[int] = None  # 2, 5, 10 or None for all
    subject: Optional[str] = None
    unit: Optional[str] = None


class StudyPackRequest(BaseModel):
    subject: str
    unit: Optional[str] = None


class ModelPaperAnswerRequest(BaseModel):
    questions: List[Dict[str, Any]]
    subject: Optional[str] = None
    unit: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/revision-notes")
def generate_revision_notes(
    payload: RevisionNotesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate high-yield revision notes with concepts, definitions, formulas, and diagrams."""
    if not payload.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")

    result = generate_revision_notes_service(
        topic=payload.topic,
        user_id=str(current_user.id),
        db=db,
        subject=payload.subject,
        unit=payload.unit,
        material_id=payload.material_id,
    )
    return result


@router.post("/exam-notes")
def generate_exam_notes(
    payload: ExamNotesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate structured university semester exam notes calibrated for 2, 5, and 10 marks."""
    if not payload.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")

    result = generate_exam_notes_service(
        topic=payload.topic,
        user_id=str(current_user.id),
        db=db,
        marks=payload.marks,
        subject=payload.subject,
        unit=payload.unit,
    )
    return result


@router.post("/study-pack")
def generate_study_pack(
    payload: StudyPackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an all-in-one Study Pack for a subject/unit with revision notes, Qs, MCQs, flashcards, diagrams."""
    if not payload.subject.strip():
        raise HTTPException(status_code=400, detail="Subject cannot be empty.")

    result = generate_study_pack_service(
        subject=payload.subject,
        unit=payload.unit,
        user_id=str(current_user.id),
        db=db,
    )
    return result


@router.post("/model-paper/extract")
async def extract_model_paper_questions(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """
    Extract questions from an uploaded PDF, Image, or pasted text.
    Preserves question numbers and detects marks.
    """
    extracted_text = ""
    filename = "paper.txt"

    if file:
        filename = file.filename or "paper.pdf"
        file_bytes = await file.read()
        extracted_text = extract_text_from_file_bytes(file_bytes, filename)
    elif raw_text:
        extracted_text = raw_text.strip()
    else:
        raise HTTPException(status_code=400, detail="Please provide either a file or question text.")

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No readable text could be extracted from the file.")

    questions = parse_questions_from_text(extracted_text)

    return {
        "filename": filename,
        "raw_text_length": len(extracted_text),
        "total_questions": len(questions),
        "questions": questions,
    }


@router.post("/model-paper/answer")
def answer_single_model_paper_question(
    question: Dict[str, Any] = Body(...),
    subject: Optional[str] = Body(None),
    unit: Optional[str] = Body(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Answer a single question from the model paper according to its detected marks."""
    if not question.get("question"):
        raise HTTPException(status_code=400, detail="Question text is missing.")

    result = answer_model_paper_question(
        question_item=question,
        user_id=str(current_user.id),
        db=db,
        subject=subject,
        unit=unit,
    )
    return result


@router.post("/model-paper/answer-all")
def answer_all_model_paper_questions(
    payload: ModelPaperAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Answer all or selected questions from the model paper with RAG grounding."""
    if not payload.questions:
        raise HTTPException(status_code=400, detail="No questions provided to answer.")

    results = []
    for q in payload.questions:
        answered = answer_model_paper_question(
            question_item=q,
            user_id=str(current_user.id),
            db=db,
            subject=payload.subject,
            unit=payload.unit,
        )
        results.append(answered)

    return {
        "total_answered": len(results),
        "answers": results,
    }
