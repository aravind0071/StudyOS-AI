"""
RAG Service — StudyOS AI
Retrieval-Augmented Generation pipeline:
1. Normalize query and extract core academic terms / concepts
2. Multi-pass search across user's uploaded materials (MaterialChunks & Subject Resources)
3. Prioritize exact phrases, question titles, and subject/unit matches
4. Apply strict relevance threshold to prevent hallucinations or fake citations
5. Format prompt with student's materials as PRIMARY source
6. Generate structured, exam-ready response (OpenAI / Gemini / Educational Knowledge Engine)
7. Support both synchronous REST and real-time Server-Sent Events (SSE) streaming
"""

import logging
import re
import json
import time
from typing import Optional, List, Dict, Any, AsyncGenerator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import MaterialChunk, Material, Resource, ChatSession, ChatMessage
from app.services.educational_kb import generate_structured_response, detect_marks, check_query_explicit_marks

logger = logging.getLogger(__name__)

STOPWORDS = {
    "what", "is", "a", "an", "the", "in", "on", "at", "to", "for", "of", "with",
    "by", "and", "or", "how", "does", "do", "explain", "describe", "tell", "me",
    "about", "give", "write", "define", "definition", "marks", "mark", "2m", "5m",
    "10m", "16m", "question", "answer", "please", "can", "you", "detailed", "brief",
    "simple", "simply", "overview", "study", "lecture", "notes", "slide", "slides"
}

EXPLAIN_LEVELS = {
    "beginner": "Explain in very simple terms with everyday real-world analogies. Avoid jargon. Clear and intuitive.",
    "btech_student": "Give a technical explanation appropriate for a B.Tech/engineering semester exam. Include definitions, mechanisms, and clear technical details.",
    "exam": "Provide a structured university exam-style answer with formal headings, definitions, steps, diagrams, comparisons, and conclusions.",
    "interview": "Give a concise, confident technical answer as in a technical interview with trade-offs, edge cases, and follow-up points.",
    "revision": "Provide high-yield bullet points for fast revision followed by key active-recall points.",
    "summary": "Provide an executive summary of the concepts, core formulas, and high-yield exam takeaways.",
}


def normalize_text(text: str) -> str:
    """Normalize text by lowering, removing punctuation, and collapsing whitespace."""
    if not text:
        return ""
    clean = re.sub(r"[^\w\s\-]", " ", text.lower())
    clean = re.sub(r"[\s\-_]+", " ", clean).strip()
    return clean


def extract_core_topic_and_terms(query: str) -> tuple[str, list[str]]:
    """
    Extract the clean core topic phrase and individual non-stopword keywords from a student's query.
    Handles colon prefixes like 'Explain simply for 5 marks with intuitive real-world analogies: system calls'.
    """
    q_target = query
    if ":" in query:
        parts = query.split(":", 1)
        after_colon = parts[1].strip()
        if len(after_colon) >= 2:
            q_target = after_colon

    clean_q = re.sub(
        r"^(what is|what are|define|explain about|explain simply|explain|describe|tell me about|how does|give an account on|write short notes on|discuss about|discuss|give a|solve a|provide a)\s+",
        "",
        q_target,
        flags=re.IGNORECASE,
    )
    clean_q = re.sub(r"\s+for\s+\d+\s*marks?.*$", "", clean_q, flags=re.IGNORECASE)
    clean_q = re.sub(r"^(about|on)\s+", "", clean_q, flags=re.IGNORECASE)
    clean_q = re.sub(r"[?!.,;:]+$", "", clean_q).strip()

    norm_q = normalize_text(clean_q)
    tokens = norm_q.split()
    filtered_tokens = [t for t in tokens if t not in STOPWORDS and len(t) > 1]

    clean_topic = " ".join(filtered_tokens) if filtered_tokens else norm_q
    return clean_topic, filtered_tokens if filtered_tokens else norm_q.split()


from app.services.query_understanding import (
    extract_topic_and_expansions,
    compute_chunk_relevance,
    normalize_query_text,
)


def retrieve_relevant_chunks(
    query: str,
    user_id: str,
    db: Session,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
    top_k: int = 5,
) -> tuple[list[dict], bool]:
    """
    Retrieve the most relevant material chunks for the user's query from their UPLOADED materials.
    Tolerant to spelling mistakes, short forms, grammar variations, and plural forms.
    Returns: (list_of_chunks, is_grounded_in_material)

    Strict anti-hallucination policy:
    Only returns grounded if the student's uploaded file content actually contains the topic.
    Never fabricates citations or claims grounding for unuploaded topics.
    """
    try:
        query_info = extract_topic_and_expansions(query)

        # Query ONLY the student's actual uploaded MaterialChunks joined with Material
        chunks = (
            db.query(MaterialChunk, Material)
            .join(Material, MaterialChunk.material_id == Material.id)
            .filter(
                MaterialChunk.user_id == user_id,
                Material.user_id == user_id,
            )
            .all()
        )

        scored: list[dict] = []
        for chunk, material in chunks:
            raw_content = chunk.content or ""
            score, has_strong_match = compute_chunk_relevance(
                query_info=query_info,
                content=raw_content,
                title=material.title or "",
                subject=subject or material.subject,
                unit=unit,
            )

            # Score threshold to filter noise
            if score >= 20.0 or has_strong_match:
                scored.append({
                    "chunk_id": str(chunk.id),
                    "content": raw_content,
                    "material_id": str(material.id),
                    "material_title": material.title,
                    "material_type": material.material_type.value if hasattr(material.material_type, "value") else str(material.material_type),
                    "page_number": chunk.page_number if (chunk.page_number and chunk.page_number > 0) else None,
                    "timestamp_start": chunk.timestamp_start,
                    "subject": material.subject,
                    "score": score,
                    "has_strong_match": has_strong_match,
                })

        # Sort by relevance score descending
        scored.sort(key=lambda x: x["score"], reverse=True)

        # Grounding check:
        # A chunk is ONLY grounded if its content genuinely supports the query
        # and has_strong_match is True with a solid score (>= 35.0)
        is_grounded = len(scored) > 0 and scored[0].get("has_strong_match", False) and scored[0]["score"] >= 35.0
        top_chunks = scored[:top_k] if is_grounded else []

        return top_chunks, is_grounded

    except Exception as e:
        logger.error(f"Chunk retrieval failed: {e}")
        return [], False


def build_system_prompt(
    context_block: str,
    explain_level: str,
    marks: Optional[int],
    study_mode: str,
    is_grounded: bool,
) -> str:
    """
    Construct an authoritative, student-focused prompt enforcing semester exam excellence:
    - First search and use ALL uploaded PDFs/notes/images as the primary source.
    - If not found, answer with reliable standard ChatGPT/Claude knowledge based on Standard University Curriculum.
    - Never refuse or say 'Topic Not Found'.
    - Always answer the EXACT question asked.
    - For diagrams: prefer uploaded diagram; otherwise create simple, neat, easy-to-draw exam diagrams.
    - Format strictly according to 2/5/10 marks with accurate, syllabus-relevant, exam-ready answers.
    """
    level_instruction = EXPLAIN_LEVELS.get(explain_level, EXPLAIN_LEVELS["btech_student"])

    marks_guideline = ""
    if marks == 2:
        marks_guideline = """
EXAM FORMAT (2 MARKS):
- Give a short, precise, high-scoring answer (total 2 to 4 lines, maximum 6 lines).
- Section 1: Definition (clear, technically accurate, syllabus-aligned).
- Section 2: Key Formula / Rule / Concrete Example (1 direct equation or rule).
- Section 3: Exam Tip (1-line high-yield memory trick or rule to secure full 2 marks).
- CRITICAL: Do NOT generate ANY diagram for 2 marks! In university exams, 2-mark answers never require diagrams.
- Do NOT write lengthy paragraphs or multi-page master solutions for 2 marks.
"""
    elif marks == 5:
        marks_guideline = """
EXAM FORMAT (5 MARKS):
- Section 1: Definition & Core Objective (clean 2-3 lines).
- Section 2: Structured Mechanism / Step-by-Step Explanation (3 to 4 sequential steps or working points).
- Section 3: Key Points / Properties (3 to 4 high-yield bullet points).
- Section 4: Practical Example (code, numerical, or concrete scenario).
- Section 5: Simple Exam Diagram (generate a simple, neat, easy-to-draw Mermaid flowchart/block diagram: 3 to 4 clean rectangular boxes e.g. graph LR or graph TD that an engineering student can quickly draw with pen and ruler in 30 seconds for full marks. Do NOT draw complicated sequence diagrams).
- Section 6: Exam Tip (high-yield exam note).
"""
    elif marks == 10 or study_mode == "exam":
        marks_guideline = """
EXAM FORMAT (10 MARKS - UNIVERSITY MASTER ANSWER):
- Section 1: Definition & Theoretical Background (comprehensive and rigorous).
- Section 2: Working Principle & System Architecture.
- Section 3: Step-by-Step Mechanism / Algorithm (clearly numbered stages).
- Section 4: Architecture Diagram (generate a clean, simple, neat, easy-to-draw Mermaid flowchart/block diagram e.g. graph LR or graph TD with 3 to 5 clear rectangular boxes and clean flow arrows suitable for full marks on paper).
- Section 5: Practical Worked Example, Code, or Numerical Walkthrough with step-by-step trace.
- Section 6: Comparative Analysis: Advantages vs. Limitations (use a clean Markdown Comparison Table).
- Section 7: Semester Exam Conclusion & Viva Takeaways.
"""
    else:
        marks_guideline = """
STANDARD ANSWER FORMAT:
1. Definition: Clear, technically precise definition in plain English.
2. Simple Explanation: Easy-to-understand explanation using intuitive mental models.
3. Important Points: Bullet points covering key properties, rules, and characteristics.
4. Exam Diagram: Simple, neat, easy-to-draw exam diagram (clean Mermaid flowchart or block diagram suitable for exam answer sheets: 3 to 4 boxes).
5. Practical Example: A concrete, realistic example (or code snippet if programming).
6. Advantages & Limitations: Crisp summary of benefits and trade-offs (using a Markdown table if comparing).
7. Short Conclusion: Summary sentence.
"""

    if is_grounded and context_block:
        return f"""You are StudyOS AI Tutor, a senior engineering professor and academic mentor.
You provide authoritative, technically rigorous, and high-scoring semester exam answers based on the Standard University Curriculum.

CORE DIRECTIVES:
1. PRIMARY SOURCE: The student's uploaded study material below (PDFs/notes/images) is your PRIMARY and AUTHORITATIVE source.
   - If the requested topic exists in this material, answer DIRECTLY and faithfully from that material.
   - Use and preserve its exact terminology, definitions, theorems, formulas, algorithms, derivations, and examples.
2. SEAMLESS RELIABLE FALLBACK (NO REFUSAL): If any detail, sub-question, or the entire topic is not found in the uploaded material:
   - Answer using reliable, standard ChatGPT/Claude knowledge based on the Standard University Curriculum.
   - CRITICAL: NEVER refuse to answer and NEVER say or write "Topic Not Found", "Not found in your uploaded materials", or output any disclaimer claiming material is missing. Always answer seamlessly and authoritatively.
3. ANSWER THE EXACT QUESTION: Always answer the EXACT question asked directly, completely, and accurately with zero generic fluff.
4. DIAGRAMS: Prefer the uploaded diagram if present or described in the notes. Otherwise, create a simple, neat, easy-to-draw exam diagram (clean Mermaid diagram: ```mermaid\\n...\\n```) that an engineering student can easily draw with pen and paper in an examination to secure full marks.
5. EXAM FORMATTING: Format strictly according to 2/5/10 marks with accurate, syllabus-relevant, exam-ready answers.

PEDAGOGICAL INSTRUCTION:
{level_instruction}

{marks_guideline}

STUDENT'S UPLOADED STUDY MATERIAL (PRIMARY SOURCE):
{context_block}
"""
    else:
        return f"""You are StudyOS AI Tutor, a senior engineering professor and academic mentor.
You provide authoritative, technically rigorous, and high-scoring semester exam answers based on the Standard University Curriculum.

CORE DIRECTIVES:
1. RELIABLE CURRICULUM KNOWLEDGE: Answer with reliable standard ChatGPT/Claude knowledge based on the Standard University Curriculum for high-scoring semester exam answers.
2. CRITICAL ANTI-REFUSAL & SEAMLESS ANSWERING:
   - NEVER refuse to answer.
   - NEVER say or write "Topic Not Found", "Not found in your uploaded materials", or output any disclaimer or apology.
   - Always deliver a direct, comprehensive, high-scoring university exam solution.
3. ANSWER THE EXACT QUESTION: Always answer the EXACT question asked directly, completely, and accurately with zero generic fluff.
4. DIAGRAMS: Create a simple, neat, easy-to-draw exam diagram (clean Mermaid diagram: ```mermaid\\n...\\n```) that an engineering student can easily draw with pen and paper in an examination to secure full marks.
5. EXAM FORMATTING: Format strictly according to 2/5/10 marks with accurate, syllabus-relevant, exam-ready answers.

PEDAGOGICAL INSTRUCTION:
{level_instruction}

{marks_guideline}
"""


def build_rag_response(
    query: str,
    user_id: str,
    db: Session,
    explain_level: Optional[str] = "btech_student",
    study_mode: Optional[str] = "learn",
    marks: Optional[int] = None,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
    session_history: Optional[list] = None,
) -> dict:
    """
    Full RAG pipeline:
    1. Retrieve relevant chunks with smart term matching and strict score threshold
    2. Extract clean sources with real page numbers (never fabricated)
    3. Determine marks and formatting structure
    4. Call OpenAI/Gemini if configured, or activate built-in Educational Knowledge Engine
    5. Clearly label the source as one of:
       - Uploaded Notes
       - Standard University Curriculum
       - ChatGPT Knowledge
       - Claude-style Knowledge
    """
    # 1. Retrieve relevant chunks
    relevant_chunks, is_grounded = retrieve_relevant_chunks(
        query=query,
        user_id=user_id,
        db=db,
        subject=subject,
        unit=unit,
        top_k=5,
    )

    # 2. Build context and sources
    context_parts: list[str] = []
    sources: list[dict] = []
    seen_materials: set[str] = set()

    for chunk in relevant_chunks:
        context_parts.append(f"[Source: {chunk['material_title']}]\n{chunk['content']}")
        mat_key = f"{chunk['material_id']}_{chunk.get('page_number')}"
        if mat_key not in seen_materials:
            source_entry = {
                "material_id": chunk["material_id"],
                "material_title": chunk["material_title"],
                "material_type": chunk["material_type"],
                "page_number": chunk.get("page_number"),
                "timestamp_start": chunk.get("timestamp_start"),
                "subject": chunk.get("subject"),
            }
            sources.append(source_entry)
            seen_materials.add(mat_key)

    context_block = "\n\n---\n\n".join(context_parts) if context_parts else ""
    # Prioritize explicit marks directly requested in the query over UI payload defaults
    query_explicit_marks = check_query_explicit_marks(query)
    effective_marks = None
    if query_explicit_marks is not None:
        effective_marks = query_explicit_marks
    elif marks is not None:
        try:
            effective_marks = int(marks)
        except (ValueError, TypeError):
            effective_marks = None
    if effective_marks is None:
        effective_marks = detect_marks(query, explain_level)
    level_key = explain_level or "btech_student"

    def finalize_response(
        raw_answer: str,
        engine_type: str,
        tokens_count: Optional[int] = None,
    ) -> dict:
        """
        Formats answer with standardized source labeling:
        - Uploaded Notes (with exact file and real page number)
        - Standard University Curriculum
        - ChatGPT Knowledge
        - Claude-style Knowledge
        Never fabricates a file name or page number.
        """
        if is_grounded and sources:
            s_type = "uploaded_notes"
            s_label = "Uploaded Notes"
            first_s = sources[0]
            title_name = first_s.get("material_title", "Uploaded Material")
            page_val = first_s.get("page_number")
            if page_val and page_val > 0:
                s_detail = f' — "{title_name}" (Page {page_val})'
            else:
                s_detail = f' — "{title_name}"'
        else:
            if engine_type == "openai":
                s_type = "chatgpt_knowledge"
                s_label = "ChatGPT Knowledge"
            elif engine_type == "gemini":
                s_type = "claude_knowledge"
                s_label = "Claude-style Knowledge"
            else:
                s_type = "university_curriculum"
                s_label = "Standard University Curriculum"
            s_detail = ""

        footer = f"\n\n---\n📌 **Source:** **{s_label}**{s_detail}"
        final_answer = raw_answer.strip()
        if "📌 **Source:**" not in final_answer:
            final_answer += footer

        return {
            "answer": final_answer,
            "sources": sources if is_grounded else [],
            "used_external_knowledge": not is_grounded,
            "source_type": s_type,
            "source_label": s_label,
            "source_detail": s_detail,
            "tokens_used": tokens_count,
        }

    # 3. Check for active OpenAI client
    client = None
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
        except Exception as e:
            logger.error(f"OpenAI client init failed: {e}")

    # 4. Attempt OpenAI if key is present
    if client:
        system_prompt = build_system_prompt(
            context_block=context_block,
            explain_level=level_key,
            marks=effective_marks,
            study_mode=study_mode or "learn",
            is_grounded=is_grounded,
        )

        messages = [{"role": "system", "content": system_prompt}]
        if session_history:
            for msg in session_history[-6:]:
                messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": query})

        try:
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                temperature=0.25,
                max_tokens=1800,
            )
            answer = response.choices[0].message.content or ""
            tokens_used = response.usage.total_tokens if response.usage else None
            return finalize_response(answer, "openai", tokens_used)
        except Exception as e:
            logger.error(f"OpenAI call failed, activating educational fallback: {e}")

    # 5. Check for optional Google Gemini API fallback
    if getattr(settings, "GEMINI_API_KEY", None):
        try:
            import httpx
            system_prompt = build_system_prompt(
                context_block=context_block,
                explain_level=level_key,
                marks=effective_marks,
                study_mode=study_mode or "learn",
                is_grounded=is_grounded,
            )
            g_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            g_payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": f"{system_prompt}\n\nStudent Query: {query}"}]}
                ],
                "generationConfig": {"temperature": 0.25, "maxOutputTokens": 1800},
            }
            g_res = httpx.post(g_url, json=g_payload, timeout=15.0)
            if g_res.status_code == 200:
                g_data = g_res.json()
                cands = g_data.get("candidates", [])
                if cands:
                    parts = cands[0].get("content", {}).get("parts", [])
                    if parts and parts[0].get("text"):
                        return finalize_response(parts[0]["text"], "gemini", len(parts[0]["text"].split()))
        except Exception as ge:
            logger.warning(f"Gemini fallback error: {ge}")

    # 6. High-Fidelity Educational Knowledge Engine
    # Directly extracts from student's material or provides curriculum-grounded master answers
    answer = generate_structured_response(
        query=query,
        explain_level=level_key,
        context_chunks=context_parts if is_grounded else [],
        material_sources=sources if is_grounded else [],
        study_mode=study_mode or "learn",
        marks=effective_marks,
    )

    return finalize_response(answer, "curriculum", len(answer.split()))


async def stream_rag_tokens(
    full_answer: str,
    chunk_size: int = 15,
    delay: float = 0.02,
) -> AsyncGenerator[str, None]:
    """
    Stream tokens smoothly for natural real-time UI typing effect.
    """
    import asyncio
    words = full_answer.split(" ")
    buffer: list[str] = []

    for word in words:
        buffer.append(word)
        if len(buffer) >= 3 or "\n" in word:
            chunk = " ".join(buffer) + " "
            yield chunk
            buffer = []
            await asyncio.sleep(delay)

    if buffer:
        yield " ".join(buffer)
