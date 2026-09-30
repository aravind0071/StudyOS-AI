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
from app.services.educational_kb import generate_structured_response, detect_marks

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
    Returns: (list_of_chunks, is_grounded_in_material)

    Strict anti-hallucination policy:
    Only returns grounded if the student's uploaded file content actually contains the topic.
    Never fabricates citations or claims grounding for unuploaded topics.
    """
    try:
        clean_topic, keywords = extract_core_topic_and_terms(query)
        if not keywords:
            keywords = normalize_text(query).split()

        norm_query = normalize_text(query)

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
            norm_content = normalize_text(raw_content)
            norm_title = normalize_text(material.title or "")
            score = 0

            # Content match is strictly required
            has_direct_content_match = bool(clean_topic and clean_topic in norm_content)
            term_matches = sum(1 for kw in keywords if len(kw) > 2 and kw in norm_content)

            # If the chunk content does not contain the topic or keywords, skip it
            if not has_direct_content_match and term_matches == 0:
                continue

            # Pass A: Exact Question / Topic Match in content
            if has_direct_content_match or (norm_query and norm_query in norm_content):
                score += 55

            # Pass B: Q&A Pattern match inside the chunk
            if clean_topic and re.search(r"(what\s+is|define|explain)\s+" + re.escape(clean_topic), norm_content):
                score += 35

            # Pass C: Material Title Match bonus ONLY if content also matches
            if clean_topic and clean_topic in norm_title:
                score += 30
            elif clean_topic and any(term in norm_title for term in keywords if len(term) > 3):
                score += 15

            # Pass D: Keyword matching & frequency
            score += term_matches * 6

            # Pass E: Subject & Unit filters
            if subject and material.subject and normalize_text(subject) in normalize_text(material.subject):
                score += 15
            if unit and material.title and normalize_text(unit) in normalize_text(material.title):
                score += 10

            # Score threshold to filter noise
            if score >= 18:
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
                })

        # Sort by relevance score descending
        scored.sort(key=lambda x: x["score"], reverse=True)

        # Grounding check:
        # Must have matching chunks and top score >= 25
        is_grounded = len(scored) > 0 and scored[0]["score"] >= 25
        top_chunks = scored[:top_k] if is_grounded else []

        return top_chunks, is_grounded

    except Exception as e:
        logger.error(f"Chunk retrieval failed: {e}")
        return [], False
        return [], False


def build_system_prompt(
    context_block: str,
    explain_level: str,
    marks: Optional[int],
    study_mode: str,
    is_grounded: bool,
) -> str:
    """
    Construct an authoritative, student-focused prompt enforcing semester exam excellence.
    """
    level_instruction = EXPLAIN_LEVELS.get(explain_level, EXPLAIN_LEVELS["btech_student"])

    marks_guideline = ""
    if marks == 2:
        marks_guideline = """
EXAM FORMAT (2 MARKS):
- Give a short, precise answer (total 2 to 4 lines).
- Section 1: Definition (clear, accurate, easy to write in exams).
- Section 2: Key Formula / Rule / Example (1 direct equation or rule).
- Section 3: Exam Tip (1-line memory trick).
- Do not write unnecessary lengthy paragraphs.
"""
    elif marks == 5:
        marks_guideline = """
EXAM FORMAT (5 MARKS):
- Section 1: Definition & Core Objective (clean 2-3 lines).
- Section 2: Structured Explanation (3 to 4 sequential steps or working mechanism).
- Section 3: Important Points (3 to 4 high-yield bullet points).
- Section 4: Practical Example (code, numerical, or concrete scenario).
- Section 5: Concept Diagram (generate a clean, relevant Mermaid flowchart/block diagram).
- Section 6: Exam Tip (high-yield exam note).
"""
    elif marks == 10 or study_mode == "exam":
        marks_guideline = """
EXAM FORMAT (10 MARKS - UNIVERSITY MASTER ANSWER):
- Section 1: Definition & Theoretical Background.
- Section 2: Working Principle & System Architecture.
- Section 3: Step-by-Step Mechanism / Algorithm (clearly numbered steps).
- Section 4: Architecture / Flow Diagram (clean Mermaid flowchart/sequence/block diagram).
- Section 5: Practical Example or Worked Problem with step-by-step trace.
- Section 6: Advantages & Limitations (use a clean Markdown Comparison Table).
- Section 7: Conclusion & Viva Takeaways.
"""
    else:
        marks_guideline = """
STANDARD ANSWER FORMAT:
1. Definition: Clear, technically precise definition in plain English.
2. Simple Explanation: Easy-to-understand explanation using intuitive mental models.
3. Important Points: Bullet points covering key properties, rules, and characteristics.
4. Example: A concrete, realistic example (or code snippet if programming).
5. Advantages & Limitations: Crisp summary of benefits and trade-offs.
6. Short Conclusion: Summary sentence.
If a diagram clarifies the concept, include a clean Mermaid flowchart or architecture block diagram.
"""

    if is_grounded and context_block:
        return f"""You are StudyOS AI Tutor, a senior engineering professor and academic mentor.
You explain concepts with clarity, technical rigor, and semester-exam excellence.

PEDAGOGICAL INSTRUCTION:
{level_instruction}

{marks_guideline}

STRICT GROUNDING RULES:
1. The student's uploaded material below is your PRIMARY and AUTHORITATIVE source.
2. Use and preserve the exact terminology, definitions, formulas, and examples from the student's material.
3. Do not invent information or unrelated concepts.
4. If the student's material has a specific answer or easy memory trick, include it prominently.
5. If the material covers part of the question, clearly state: "Note: The following additional context is from standard university curriculum."
6. Ensure Markdown formatting: clean headings (#, ##, ###), bold text for key terms, code blocks with language tags, and Markdown tables when comparing concepts.
7. If a diagram is appropriate, output clean Mermaid diagrams (```mermaid\n...\n```). Do not generate decorative diagrams.

STUDENT'S UPLOADED STUDY MATERIAL:
{context_block}
"""
    else:
        return f"""You are StudyOS AI Tutor, an expert academic tutor for university engineering students.

PEDAGOGICAL INSTRUCTION:
{level_instruction}

{marks_guideline}

CRITICAL ANTI-HALLUCINATION & TRANSPARENCY RULE:
The student's uploaded notes do NOT contain this specific topic.
Begin your answer with this exact notice:
> ⚠️ **Topic Not Found in Your Uploaded Materials**
> The required material was not found in the study materials or files you uploaded.
> *To get answers directly from your specific syllabus notes, please upload the relevant lecture notes, slides, or PDF to the Knowledge Vault.*
>
> Below is the complete, high-scoring semester exam answer based on the **Standard University Curriculum**:

FORMATTING RULES:
1. Provide a technically accurate, easy-to-understand, curriculum-grade explanation in simple English.
2. Use Markdown headings (##, ###), clean lists, and code blocks where relevant.
3. If comparing concepts, use a clean Markdown table.
4. If a diagram clarifies the concept, include a clean Mermaid flowchart or block diagram (```mermaid\n...\n```).
5. Keep the explanation well structured, memorable, and exam-ready.
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
    has_explicit_marks = bool(marks is not None or re.search(r"\b(\d+\s*marks?|\d+m|short\s*note|viva\s*note|for\s+\d+\s*marks?)\b", query, re.I))
    effective_marks = None
    if marks is not None:
        try:
            effective_marks = int(marks)
        except (ValueError, TypeError):
            effective_marks = None
    if effective_marks is None and has_explicit_marks:
        effective_marks = detect_marks(query, explain_level)
    level_key = explain_level or "btech_student"

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

            return {
                "answer": answer,
                "sources": sources if is_grounded else [],
                "used_external_knowledge": not is_grounded,
                "tokens_used": tokens_used,
            }
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
                        return {
                            "answer": parts[0]["text"],
                            "sources": sources if is_grounded else [],
                            "used_external_knowledge": not is_grounded,
                            "tokens_used": len(parts[0]["text"].split()),
                        }
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

    return {
        "answer": answer,
        "sources": sources if is_grounded else [],
        "used_external_knowledge": not is_grounded,
        "tokens_used": len(answer.split()),
    }


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
