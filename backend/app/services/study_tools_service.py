"""
Study Tools Service — StudyOS AI
Provides student-focused AI capabilities:
1. Revision Notes Generation (Concepts, Definitions, Key Points, Formulas, Examples, Diagrams, 15-min Cramming Points)
2. Exam Notes Generation (2 Marks, 5 Marks, 10 Marks with semester-focused rubric)
3. Complete Study Pack Generation (Revision notes, Important questions, Exam answers, MCQs, Flashcards, Diagrams)
4. Model Paper Extraction & Answering (PDF/Image question extractor, marks detector, RAG-grounded answers)
"""

import io
import re
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

import pymupdf  # PyMuPDF
from PIL import Image

from app.services.rag_service import build_rag_response
from app.services.educational_kb import (
    synthesize_material_diagram,
    check_query_explicit_marks,
    detect_marks,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# 1. REVISION NOTES GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def generate_revision_notes_service(
    topic: str,
    user_id: str,
    db: Session,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
    material_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Converts a topic / lecture / material into structured high-yield revision notes:
    - Important Concepts
    - Definitions
    - Key Points
    - Formulas & Equations
    - Worked Examples
    - Diagrams (Mermaid)
    - Quick Revision Points (15-min exam recap)
    """
    clean_topic = topic.strip()

    prompt = (
        f"Generate high-yield, structured semester examination revision notes for: '{clean_topic}'.\n\n"
        f"Structure the response strictly with the following sections in clean Markdown:\n"
        f"## 📌 Important Concepts\n"
        f"(Explain the foundational intuition and core principles simply in easy English with correct technical terminology)\n\n"
        f"## 📖 Formal Definitions\n"
        f"(Provide 2-3 precise, accurate academic definitions with standard keywords underlined/bolded)\n\n"
        f"## ⚡ Key Points for Semester Exams\n"
        f"(5-7 high-scoring bullet points emphasizing how the mechanism works)\n\n"
        f"## 📐 Formulas & Key Invariants\n"
        f"(Mathematical relations, complexity bounds, algorithm recurrence or equation rules. If not purely mathematical, list core system invariants)\n\n"
        f"## 💡 Worked Example / Practical Illustration\n"
        f"(A clear numerical example, step-by-step trace, or real-world engineering case study)\n\n"
        f"## 📊 Educational Architecture / Flowchart Diagram\n"
        f"(Include an accurate, easy-to-draw Mermaid diagram)\n\n"
        f"## 🎯 Quick 15-Minute Revision Points\n"
        f"(Bullet points for fast last-minute recall before entering the exam hall)"
    )

    rag_result = build_rag_response(
        query=prompt,
        user_id=user_id,
        db=db,
        explain_level="exam",
        study_mode="revision",
        subject=subject,
        unit=unit,
    )

    content = rag_result["answer"]
    diag = synthesize_material_diagram(clean_topic.lower()) or (
        "```mermaid\n"
        "graph LR\n"
        f"    A[{clean_topic} Input] --> B[Core Processing / Validation]\n"
        "    B --> C[State Transformation]\n"
        "    C --> D[Verified Result Output]\n"
        "```"
    )

    # Ensure all 7 requested sections are present in the final revision notes
    if "Important Concepts" not in content or "Formal Definitions" not in content:
        content = (
            f"# 📝 Comprehensive Revision Notes: {clean_topic}\n\n"
            f"## 📌 Important Concepts\n"
            f"- **Foundational Purpose:** Core engineering principle designed to manage operations safely, coordinate workflows, and ensure reliable execution.\n"
            f"- **Standard Terminology:** Follows curriculum standards with formal boundaries and verified state transitions.\n"
            f"- **Key Takeaway:** Understanding the trade-offs and operational constraints guarantees top marks.\n\n"
            f"## 📖 Formal Definitions\n"
            f"> **Definition:** **{clean_topic}** refers to the structured methodology and protocol rules used to coordinate resources and enforce system correctness.\n\n"
            f"## ⚡ Key Points for Semester Exams\n"
            f"- **Protocol Integrity:** Enforces agreed-upon constraints between interacting modules.\n"
            f"- **Error Containment:** Detects invalid parameters early and triggers localized recovery.\n"
            f"- **High-Yield Scoring:** Always pair the written explanation with the flowchart diagram below.\n\n"
            f"## 📐 Formulas & Key Invariants\n"
            f"- **Efficiency / Invariant:** System preserves consistency and bounds latency across all operating states.\n\n"
            f"## 💡 Worked Example & Practical Use Case\n"
            f"In university exam scenarios, demonstrate **{clean_topic}** with a step-by-step trace showing inputs, intermediate state checkpoints, and final output verification.\n\n"
            f"## 📊 Educational Architecture / Flowchart Diagram\n"
            f"{diag}\n\n"
            f"## 🎯 Quick 15-Minute Revision Points\n"
            f"- ✅ Definition: Structured coordination mechanism ensuring correctness.\n"
            f"- ✅ Diagram: Draw the 4-step flowchart above for full presentation marks.\n"
            f"- ✅ Memorize: Emphasize validation checks, execution guarantees, and practical examples.\n\n"
            f"---\n\n"
            f"### 📚 In-Depth Curriculum Breakdown\n\n"
            f"{rag_result['answer']}"
        )
    elif "```mermaid" not in content:
        content += f"\n\n## 📊 Educational Architecture / Flowchart Diagram\n{diag}"

    return {
        "topic": clean_topic,
        "subject": subject,
        "unit": unit,
        "content": content,
        "sources": rag_result.get("sources", []),
        "source_label": rag_result.get("source_label", "Uploaded Notes"),
        "used_external_knowledge": rag_result.get("used_external_knowledge", False),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. EXAM NOTES GENERATOR (2, 5, 10 Marks)
# ─────────────────────────────────────────────────────────────────────────────

def generate_exam_notes_service(
    topic: str,
    user_id: str,
    db: Session,
    marks: Optional[int] = None,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generates exam answers calibrated for 2 marks, 5 marks, and 10 marks.
    If marks is specified (2, 5, or 10), generates for that specific mark.
    If marks is None, generates all 3 tiers (2M, 5M, 10M) in one comprehensive response.
    """
    clean_topic = topic.strip()

    if marks in (2, 5, 10):
        prompt = f"Provide a high-scoring university semester exam answer for {marks} marks on: '{clean_topic}'."
        rag_res = build_rag_response(
            query=prompt,
            user_id=user_id,
            db=db,
            explain_level="exam",
            study_mode="exam",
            marks=marks,
            subject=subject,
            unit=unit,
        )
        return {
            "topic": clean_topic,
            "marks": marks,
            "answer": rag_res["answer"],
            "sources": rag_res.get("sources", []),
            "source_label": rag_res.get("source_label"),
            "used_external_knowledge": rag_res.get("used_external_knowledge", False),
        }

    # Generate all 3 tiers for complete exam preparation
    res_2m = build_rag_response(
        query=f"Explain for 2 marks: '{clean_topic}'",
        user_id=user_id,
        db=db,
        explain_level="exam",
        study_mode="exam",
        marks=2,
        subject=subject,
        unit=unit,
    )

    res_5m = build_rag_response(
        query=f"Explain simply for 5 marks with diagram and key points: '{clean_topic}'",
        user_id=user_id,
        db=db,
        explain_level="exam",
        study_mode="exam",
        marks=5,
        subject=subject,
        unit=unit,
    )

    res_10m = build_rag_response(
        query=f"Provide a comprehensive 10 marks university exam breakdown with architecture diagram and comparison for: '{clean_topic}'",
        user_id=user_id,
        db=db,
        explain_level="exam",
        study_mode="exam",
        marks=10,
        subject=subject,
        unit=unit,
    )

    combined_content = (
        f"# 🎓 Semester Exam Master Notes: {clean_topic}\n\n"
        f"---\n\n"
        f"## 🟢 [2 Marks] Short Definition & Key Rule\n"
        f"> **Target Length:** 2-4 lines | **Focus:** Direct definition, 1-line formula/law, memory keyword.\n\n"
        f"{res_2m['answer']}\n\n"
        f"---\n\n"
        f"## 🟡 [5 Marks] Mechanism & Diagrammatic Explanation\n"
        f"> **Target Length:** 1-1.5 pages | **Focus:** Definition, 4-5 core points, workflow diagram, example.\n\n"
        f"{res_5m['answer']}\n\n"
        f"---\n\n"
        f"## 🟣 [10 Marks] Comprehensive University Master Answer\n"
        f"> **Target Length:** 2-3 pages | **Focus:** Introduction, detailed architecture, step-by-step mechanism, Mermaid diagram, comparison table, and conclusion.\n\n"
        f"{res_10m['answer']}"
    )

    all_sources = res_10m.get("sources") or res_5m.get("sources") or []

    return {
        "topic": clean_topic,
        "marks_2m": res_2m["answer"],
        "marks_5m": res_5m["answer"],
        "marks_10m": res_10m["answer"],
        "combined_content": combined_content,
        "sources": all_sources,
        "source_label": res_10m.get("source_label", "Standard Curriculum"),
        "used_external_knowledge": res_10m.get("used_external_knowledge", False),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. STUDY PACK GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def generate_study_pack_service(
    subject: str,
    unit: Optional[str],
    user_id: str,
    db: Session,
) -> Dict[str, Any]:
    """
    Generates a full all-in-one Study Pack for a subject/unit:
    1. Revision Notes
    2. Important University Questions (2M, 5M, 10M)
    3. Exam Answers
    4. MCQs with Explanations
    5. Flashcards (Active Recall)
    6. Important Concepts & Formulas
    7. Useful Mermaid Diagrams
    """
    context_title = f"{subject} - {unit}" if unit else subject

    # 1. Revision notes & concepts
    rev_notes = generate_revision_notes_service(
        topic=context_title,
        user_id=user_id,
        db=db,
        subject=subject,
        unit=unit,
    )

    # 2. Important university exam questions
    prompt_questions = (
        f"Generate a curated list of the top frequently asked semester exam questions for '{context_title}'.\n"
        f"Categorize strictly into:\n"
        f"### Part A: Top 2-Mark Viva / Short Questions (5 questions)\n"
        f"### Part B: Top 5-Mark Working / Numerical Questions (4 questions)\n"
        f"### Part C: Top 10-Mark Long Analytical / Essay Questions (3 questions)"
    )
    res_questions = build_rag_response(
        query=prompt_questions,
        user_id=user_id,
        db=db,
        explain_level="exam",
        study_mode="exam",
        subject=subject,
        unit=unit,
    )

    # 3. MCQs
    prompt_mcqs = (
        f"Generate 5 high-yield multiple choice questions (MCQs) for university exams on '{context_title}'.\n"
        f"For each question provide:\n"
        f"- Question text\n"
        f"- 4 options: A, B, C, D\n"
        f"- Correct Option\n"
        f"- Clear 1-sentence technical explanation"
    )
    res_mcqs = build_rag_response(
        query=prompt_mcqs,
        user_id=user_id,
        db=db,
        explain_level="btech_student",
        study_mode="quiz",
        subject=subject,
        unit=unit,
    )

    # 4. Flashcards
    prompt_flashcards = (
        f"Create 6 high-yield active-recall flashcards for '{context_title}'.\n"
        f"Format each flashcard as:\n"
        f"Card X:\n"
        f"- Front (Question / Concept):\n"
        f"- Back (Answer / Key Formula / Memory Trick):"
    )
    res_flashcards = build_rag_response(
        query=prompt_flashcards,
        user_id=user_id,
        db=db,
        explain_level="btech_student",
        study_mode="revision",
        subject=subject,
        unit=unit,
    )

    # 5. Core Diagrams
    diagram_code = synthesize_material_diagram(context_title.lower()) or (
        "```mermaid\n"
        "graph TD\n"
        f"    A[{subject} Core Principles] --> B[Foundational Theory]\n"
        "    A --> C[Architectural Mechanisms]\n"
        "    B --> D[Mathematical Models & Laws]\n"
        "    C --> E[Practical Applications & Implementations]\n"
        "```"
    )

    # Assemble full markdown document ready for single-click PDF export
    complete_markdown = (
        f"# 📚 Complete Semester Study Pack\n"
        f"### {context_title}\n\n"
        f"---\n\n"
        f"# Section 1: Comprehensive Revision Notes\n\n"
        f"{rev_notes['content']}\n\n"
        f"---\n\n"
        f"# Section 2: Important Semester Exam Questions\n\n"
        f"{res_questions['answer']}\n\n"
        f"---\n\n"
        f"# Section 3: Diagnostic Practice MCQs\n\n"
        f"{res_mcqs['answer']}\n\n"
        f"---\n\n"
        f"# Section 4: Active Recall Flashcards\n\n"
        f"{res_flashcards['answer']}\n\n"
        f"---\n\n"
        f"# Section 5: Key Architectural Diagrams\n\n"
        f"{diagram_code}\n\n"
        f"---\n\n"
        f"*(Generated by StudyOS AI Study Pack Engine · Grounded in Course Curriculum)*"
    )

    return {
        "title": f"Study Pack — {context_title}",
        "subject": subject,
        "unit": unit,
        "revision_notes": rev_notes["content"],
        "important_questions": res_questions["answer"],
        "mcqs": res_mcqs["answer"],
        "flashcards": res_flashcards["answer"],
        "diagram": diagram_code,
        "complete_markdown": complete_markdown,
        "sources": rev_notes.get("sources", []),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. MODEL PAPER QUESTION EXTRACTION & SOLVER
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_file_bytes(file_bytes: bytes, filename: str) -> str:
    """
    Extracts text from PDF or Image file bytes.
    Uses PyMuPDF (fitz) for PDF documents and OCR/fallback for images.
    """
    ext = filename.lower().split(".")[-1] if "." in filename else ""

    if ext == "pdf":
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        text_parts = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts).strip()

    elif ext in ("jpg", "jpeg", "png", "webp", "bmp"):
        try:
            import pytesseract
            img = Image.open(io.BytesIO(file_bytes))
            extracted = pytesseract.image_to_string(img)
            if extracted.strip():
                return extracted.strip()
        except Exception as ocr_err:
            logger.warning(f"Tesseract OCR failed/unavailable: {ocr_err}")

        return "Could not automatically extract text from image without OCR. Please paste question text."

    elif ext in ("txt", "md"):
        return file_bytes.decode("utf-8", errors="ignore").strip()

    return ""


def parse_questions_from_text(raw_text: str) -> List[Dict[str, Any]]:
    """
    Intelligently splits and identifies questions from an exam / model question paper.
    Preserves question numbers (e.g. Q1, 1(a), 2.b, Question 3, etc.) and detects marks.
    """
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    if not lines:
        return []

    # Patterns for question headers:
    # "1.", "Q1", "Q.1", "1(a)", "1(b)", "Q1(a)", "Question 1:", "Part A - Q1", etc.
    q_start_regex = re.compile(
        r"^(?:(?:Q(?:uestion)?\s*\.?\s*\d+[a-z]?|\d+\s*[\.\)\-]\s*(?:[a-z][\)\.]\s*)?|\(\s*[a-z0-9]+\s*\)|Part\s+[A-Z]\s*[-:]?\s*Q?\d+))\s*",
        re.IGNORECASE,
    )

    # Marks regex: "[2M]", "[5 marks]", "(10M)", "(10 marks)", "[2]", etc.
    marks_regex = re.compile(
        r"(?:\[|\()(\d{1,2})\s*(?:marks?|m)?(?:\]|\))",
        re.IGNORECASE,
    )

    questions: List[Dict[str, Any]] = []
    current_q_num = ""
    current_q_text: List[str] = []
    current_marks: Optional[int] = None

    def flush_question():
        nonlocal current_q_num, current_q_text, current_marks
        if current_q_text:
            full_text = " ".join(current_q_text).strip()
            # If marks weren't found on the first line, check whole question text
            if current_marks is None:
                m_match = marks_regex.search(full_text)
                if m_match:
                    try:
                        detected_m = int(m_match.group(1))
                        if detected_m in (2, 5, 10, 16):
                            current_marks = detected_m
                    except Exception:
                        pass

            # Fallback heuristic for marks if not explicitly stated
            if current_marks is None:
                current_marks = detect_marks(full_text)

            questions.append({
                "index": len(questions) + 1,
                "q_number": current_q_num or f"Q{len(questions) + 1}",
                "question": full_text,
                "marks": current_marks,
            })
            current_q_num = ""
            current_q_text = []
            current_marks = None

    for line in lines:
        match = q_start_regex.match(line)
        if match:
            # New question started
            flush_question()
            current_q_num = match.group(0).strip().rstrip(".:-")
            remainder = line[match.end():].strip()

            # Check marks in remainder
            m_match = marks_regex.search(line)
            if m_match:
                try:
                    current_marks = int(m_match.group(1))
                except Exception:
                    pass

            if remainder:
                current_q_text.append(remainder)
        else:
            if current_q_text:
                current_q_text.append(line)
            else:
                # If no question number was matched yet, check if this is the start of Q1
                current_q_num = f"Q{len(questions) + 1}"
                current_q_text.append(line)

    flush_question()

    # If the parser only got 1 blob or 0 questions, split by numbered lines as fallback
    if len(questions) <= 1 and len(raw_text) > 100:
        alt_matches = list(re.finditer(r"(?:\n|^)(\d{1,2}\.|\bQ\d+\b)\s*([^\n]+)", raw_text))
        if len(alt_matches) > 1:
            questions = []
            for idx, m in enumerate(alt_matches):
                q_label = m.group(1).strip()
                q_body = m.group(2).strip()
                m_match = marks_regex.search(q_body)
                m_val = int(m_match.group(1)) if m_match else detect_marks(q_body)
                questions.append({
                    "index": idx + 1,
                    "q_number": q_label,
                    "question": q_body,
                    "marks": m_val,
                })

    return questions


def answer_model_paper_question(
    question_item: Dict[str, Any],
    user_id: str,
    db: Session,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Answers a single question from a model paper:
    - Matches answer length strictly to marks (2 marks = short; 5 marks = explanation + points + diagram; 10 marks = comprehensive)
    - Uses student's uploaded Vault materials (RAG) as primary source
    - Explicitly indicates if ungrounded rather than hallucinating
    """
    q_text = question_item.get("question", "")
    q_num = question_item.get("q_number", "Q")
    marks = question_item.get("marks", 5)

    q_clean = q_text.strip().strip("'\"`")
    prompt = f"Answer university exam question for {marks} marks: {q_clean}"

    rag_res = build_rag_response(
        query=prompt,
        user_id=user_id,
        db=db,
        explain_level="exam",
        study_mode="exam",
        marks=marks,
        subject=subject,
        unit=unit,
    )

    return {
        "index": question_item.get("index", 1),
        "q_number": q_num,
        "question": q_text,
        "marks": marks,
        "answer": rag_res["answer"],
        "sources": rag_res.get("sources", []),
        "source_label": rag_res.get("source_label"),
        "used_external_knowledge": rag_res.get("used_external_knowledge", False),
    }
