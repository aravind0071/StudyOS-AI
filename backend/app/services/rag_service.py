"""
RAG Service — StudyOS AI
Retrieval-Augmented Generation pipeline:
1. Embed user query
2. Vector search for relevant chunks in user's materials
3. Build context-aware prompt
4. Call LLM with grounded context
5. Return answer with source citations

Why RAG?
- Prevents hallucination by grounding answers in the student's actual materials
- Provides source citations so students know where information came from
- More accurate than pure LLM responses for domain-specific study content
"""

import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.models.models import MaterialChunk, Material
from app.services.educational_kb import generate_structured_response

logger = logging.getLogger(__name__)

EXPLAIN_LEVELS = {
    "beginner": "Explain this in very simple terms with real-world analogies. Avoid jargon. Speak like you're explaining to a 10th grader.",
    "btech_student": "Give a technical explanation appropriate for a B.Tech/engineering student. Include definitions, mechanisms, and relevant technical details.",
    "exam": "Provide a structured exam-style answer with: Definition, Detailed Explanation, Key Points, Advantages/Disadvantages (if applicable), and a Conclusion. Use headings.",
    "interview": "Give a concise, confident technical answer as if in a job interview. Then list 3 likely follow-up interview questions on this topic.",
}


def retrieve_relevant_chunks(
    query: str,
    user_id: str,
    db: Session,
    top_k: int = 5,
) -> list[dict]:
    """
    Retrieve the most relevant material chunks for the user's query.
    Uses simple text search as fallback when pgvector is not available.
    In production, replace with pgvector cosine similarity search.
    """
    try:
        # Simple keyword-based retrieval (fallback)
        # In production: generate query embedding → pgvector <=> cosine search
        keywords = query.lower().split()
        chunks = (
            db.query(MaterialChunk, Material)
            .join(Material, MaterialChunk.material_id == Material.id)
            .filter(
                MaterialChunk.user_id == user_id,
                Material.user_id == user_id,
            )
            .all()
        )

        # Score chunks by keyword overlap
        scored = []
        for chunk, material in chunks:
            content_lower = chunk.content.lower()
            score = sum(1 for kw in keywords if kw in content_lower)
            if score > 0:
                scored.append({
                    "chunk_id": str(chunk.id),
                    "content": chunk.content,
                    "material_id": str(material.id),
                    "material_title": material.title,
                    "material_type": material.material_type.value,
                    "page_number": chunk.page_number,
                    "timestamp_start": chunk.timestamp_start,
                    "score": score,
                })

        # Sort by score and return top_k
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    except Exception as e:
        logger.error(f"Chunk retrieval failed: {e}")
        return []


def build_rag_response(
    query: str,
    user_id: str,
    db: Session,
    explain_level: Optional[str] = "btech_student",
    session_history: Optional[list] = None,
) -> dict:
    """
    Full RAG pipeline: retrieve context → build prompt → call LLM → return response + citations.
    """
    # Retrieve relevant chunks first
    relevant_chunks = retrieve_relevant_chunks(query, user_id, db)

    # Build context block
    context_parts = []
    sources = []
    seen_materials = set()

    for chunk in relevant_chunks:
        context_parts.append(f"[Source: {chunk['material_title']}]\n{chunk['content']}")
        mat_key = chunk["material_id"]
        if mat_key not in seen_materials:
            source_entry = {
                "material_id": chunk["material_id"],
                "material_title": chunk["material_title"],
                "material_type": chunk["material_type"],
                "page_number": chunk.get("page_number"),
                "timestamp_start": chunk.get("timestamp_start"),
            }
            sources.append(source_entry)
            seen_materials.add(mat_key)

    used_external = len(context_parts) == 0
    context_block = "\n\n---\n\n".join(context_parts) if context_parts else ""

    # Check for live OpenAI client
    client = None
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
        except Exception as e:
            logger.error(f"OpenAI client init failed: {e}")

    # 1. Attempt OpenAI if client is active
    if client:
        level_instruction = EXPLAIN_LEVELS.get(explain_level or "btech_student", EXPLAIN_LEVELS["btech_student"])
        if context_block:
            system_prompt = f"""You are StudyOS AI Tutor, an intelligent educational assistant.
You help students understand their study materials.

INSTRUCTION: {level_instruction}

IMPORTANT RULES:
1. Base your answer primarily on the provided study material excerpts below.
2. If the answer is fully covered by the provided material, answer from the material.
3. If the material is relevant but incomplete, supplement with general knowledge and clearly state: "Note: The following is from general knowledge, not your uploaded materials."
4. If the topic is completely absent from the material, state: "I couldn't find this topic in your uploaded materials. Here is a general explanation:" then answer.
5. Never fabricate information or make up content from the student's materials.

STUDENT'S STUDY MATERIAL:
{context_block}"""
        else:
            system_prompt = f"""You are StudyOS AI Tutor, an intelligent educational assistant.
INSTRUCTION: {level_instruction}
Note: The student has not uploaded materials on this topic yet. Providing a general explanation."""

        messages = [{"role": "system", "content": system_prompt}]
        if session_history:
            for msg in session_history[-6:]:
                messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": query})

        try:
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                temperature=0.3,
                max_tokens=1500,
            )
            answer = response.choices[0].message.content
            tokens_used = response.usage.total_tokens if response.usage else None

            return {
                "answer": answer,
                "sources": sources,
                "used_external_knowledge": used_external,
                "tokens_used": tokens_used,
            }
        except Exception as e:
            logger.error(f"OpenAI call failed, activating educational fallback: {e}")

    # 2. Check for optional Google Gemini API fallback
    if getattr(settings, "GEMINI_API_KEY", None):
        try:
            import httpx
            g_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            g_payload = {
                "contents": [{"parts": [{"text": f"Study Query: {query}\nExplain Level: {explain_level}\n\nContext:\n{context_block if context_block else 'General Engineering/Computer Science Topic'}"}]}],
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1500},
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
                            "sources": sources,
                            "used_external_knowledge": used_external,
                            "tokens_used": len(parts[0]["text"].split()),
                        }
        except Exception as ge:
            logger.warning(f"Gemini fallback error: {ge}")

    # 3. High-Fidelity Educational Knowledge Engine (Guaranteed zero-downtime, pedagogical problem solving)
    answer = generate_structured_response(
        query=query,
        explain_level=explain_level or "btech_student",
        context_chunks=context_parts,
        material_sources=sources,
    )
    return {
        "answer": answer,
        "sources": sources,
        "used_external_knowledge": used_external,
        "tokens_used": len(answer.split()),
    }
