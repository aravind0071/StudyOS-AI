"""Search router — semantic and keyword search across user's materials."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User, MaterialChunk, Material, Concept, QuizQuestion

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("/")
def search(
    q: str = Query(..., min_length=1),
    filter_type: Optional[str] = Query(None),  # all, documents, topics, questions
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Semantic search across user's materials, topics, and questions.
    In production: use pgvector similarity search on query embedding.
    Current: keyword-based search as foundation.
    """
    query_lower = q.lower()
    keywords = query_lower.split()
    results = []

    # Search material chunks
    if not filter_type or filter_type in ("all", "documents"):
        chunks = (
            db.query(MaterialChunk, Material)
            .join(Material, MaterialChunk.material_id == Material.id)
            .filter(MaterialChunk.user_id == current_user.id)
            .all()
        )
        for chunk, material in chunks:
            content_lower = chunk.content.lower()
            score = sum(1 for kw in keywords if kw in content_lower)
            if score > 0:
                snippet = _extract_snippet(chunk.content, q)
                results.append({
                    "type": "document",
                    "title": material.title,
                    "snippet": snippet,
                    "material_id": str(material.id),
                    "chunk_id": str(chunk.id),
                    "page_number": chunk.page_number,
                    "score": score,
                })

    # Search concepts/topics
    if not filter_type or filter_type in ("all", "topics"):
        concepts = (
            db.query(Concept)
            .filter(Concept.user_id == current_user.id)
            .all()
        )
        for concept in concepts:
            name_lower = concept.name.lower()
            desc_lower = (concept.description or "").lower()
            score = sum(1 for kw in keywords if kw in name_lower or kw in desc_lower)
            if score > 0:
                results.append({
                    "type": "topic",
                    "title": concept.name,
                    "snippet": concept.description or "",
                    "concept_id": str(concept.id),
                    "score": score * 2,  # boost topic matches
                })

    # Search quiz questions
    if not filter_type or filter_type in ("all", "questions"):
        questions = (
            db.query(QuizQuestion)
            .filter(QuizQuestion.user_id == current_user.id)
            .all()
        )
        for question in questions:
            q_lower = question.question_text.lower()
            score = sum(1 for kw in keywords if kw in q_lower)
            if score > 0:
                results.append({
                    "type": "question",
                    "title": question.question_text[:100],
                    "snippet": question.explanation or "",
                    "question_id": str(question.id),
                    "topic": question.topic,
                    "score": score,
                })

    # Sort by relevance score
    results.sort(key=lambda x: x["score"], reverse=True)

    return {
        "query": q,
        "total": len(results),
        "results": results[:20],  # top 20 results
    }


def _extract_snippet(text: str, query: str, context_chars: int = 200) -> str:
    """Extract a relevant snippet from text around the query term."""
    query_lower = query.lower()
    text_lower = text.lower()
    idx = text_lower.find(query_lower.split()[0] if query_lower.split() else "")
    if idx == -1:
        return text[:context_chars] + ("..." if len(text) > context_chars else "")
    start = max(0, idx - context_chars // 2)
    end = min(len(text), idx + context_chars // 2)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet
