from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import (
    User, MaterialChunk, Material, Concept, QuizQuestion,
    Subject, Unit, Resource, Note, ChatSession, ChatMessage, StudyPlan, StudyTask
)

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("/")
def search(
    q: str = Query(..., min_length=1),
    filter_type: Optional[str] = Query(None),  # all, subjects, units, resources, documents, chats, notes, study_plans
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Comprehensive search across user's subjects, units, resources, notes,
    uploaded materials, AI chats, study plans, and concepts with strict user isolation.
    """
    query_lower = q.lower().strip()
    keywords = [kw for kw in query_lower.split() if kw]
    if not keywords:
        return {"query": q, "total": 0, "results": [], "grouped": {}}

    results: List[Dict[str, Any]] = []
    grouped: Dict[str, List[Dict[str, Any]]] = {
        "subjects": [],
        "units": [],
        "resources": [],
        "documents": [],
        "chats": [],
        "notes": [],
        "study_plans": [],
    }

    def calc_score(text: Optional[str]) -> int:
        if not text:
            return 0
        t_lower = text.lower()
        score = 0
        if query_lower in t_lower:
            score += 5
        for kw in keywords:
            if kw in t_lower:
                score += 1
        return score

    # 1. Subjects
    if not filter_type or filter_type in ("all", "subjects"):
        subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
        for sub in subjects:
            s = calc_score(sub.name) * 3 + calc_score(sub.code) * 3 + calc_score(sub.description)
            if s > 0:
                item = {
                    "type": "subject",
                    "title": sub.name,
                    "code": sub.code,
                    "snippet": sub.description or f"Subject: {sub.name}",
                    "id": str(sub.id),
                    "url": f"/subjects/{sub.id}",
                    "score": s,
                }
                results.append(item)
                grouped["subjects"].append(item)

    # 2. Units
    if not filter_type or filter_type in ("all", "units"):
        units = (
            db.query(Unit, Subject)
            .join(Subject, Unit.subject_id == Subject.id)
            .filter(Subject.user_id == current_user.id)
            .all()
        )
        for unit, sub in units:
            s = calc_score(unit.title) * 2 + calc_score(unit.description)
            if s > 0:
                item = {
                    "type": "unit",
                    "title": f"Unit {unit.unit_number}: {unit.title}",
                    "subject": sub.name,
                    "snippet": unit.description or f"{sub.name} - Unit {unit.unit_number}",
                    "id": str(unit.id),
                    "url": f"/subjects/{sub.id}?unit={unit.unit_number}",
                    "score": s,
                }
                results.append(item)
                grouped["units"].append(item)

    # 3. Resources (Notes, PDFs, Videos, YouTube, Images, etc.)
    if not filter_type or filter_type in ("all", "resources"):
        resources = db.query(Resource).filter(Resource.user_id == current_user.id).all()
        for res in resources:
            s = calc_score(res.title) * 2 + calc_score(res.description) + calc_score(res.tags)
            if s > 0:
                item = {
                    "type": "resource",
                    "resource_type": res.resource_type,
                    "title": res.title,
                    "snippet": res.description or f"{res.resource_type.capitalize()} resource",
                    "url": res.url or res.file_path or f"/subjects/{res.subject_id}",
                    "id": str(res.id),
                    "score": s,
                }
                results.append(item)
                grouped["resources"].append(item)

    # 4. Uploaded Material Chunks & Documents
    if not filter_type or filter_type in ("all", "documents"):
        chunks = (
            db.query(MaterialChunk, Material)
            .join(Material, MaterialChunk.material_id == Material.id)
            .filter(MaterialChunk.user_id == current_user.id)
            .all()
        )
        seen_materials = set()
        for chunk, material in chunks:
            s = calc_score(material.title) * 2 + calc_score(chunk.content)
            if s > 0:
                snippet = _extract_snippet(chunk.content, q)
                item = {
                    "type": "document",
                    "title": material.title,
                    "snippet": snippet,
                    "material_id": str(material.id),
                    "chunk_id": str(chunk.id),
                    "page_number": chunk.page_number,
                    "url": f"/documents/{material.id}",
                    "score": s,
                }
                results.append(item)
                if material.id not in seen_materials:
                    grouped["documents"].append(item)
                    seen_materials.add(material.id)

    # 5. AI Chats
    if not filter_type or filter_type in ("all", "chats"):
        sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).all()
        for sess in sessions:
            s = calc_score(sess.title) * 2 + calc_score(sess.subject)
            if s > 0:
                item = {
                    "type": "chat",
                    "title": sess.title or "AI Study Session",
                    "snippet": f"Subject: {sess.subject}" if sess.subject else "AI Study Conversation",
                    "id": str(sess.id),
                    "url": f"/tutor?session={sess.id}",
                    "score": s,
                }
                results.append(item)
                grouped["chats"].append(item)

        # Also search recent messages
        messages = (
            db.query(ChatMessage, ChatSession)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .filter(ChatSession.user_id == current_user.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(100)
            .all()
        )
        for msg, sess in messages:
            s = calc_score(msg.content)
            if s > 0:
                item = {
                    "type": "chat",
                    "title": f"Chat: {sess.title or 'AI Tutor'}",
                    "snippet": _extract_snippet(msg.content, q),
                    "id": str(sess.id),
                    "url": f"/tutor?session={sess.id}",
                    "score": s,
                }
                results.append(item)

    # 6. Notes
    if not filter_type or filter_type in ("all", "notes"):
        notes = db.query(Note).filter(Note.user_id == current_user.id).all()
        for note in notes:
            s = calc_score(note.title) * 2 + calc_score(note.content) + calc_score(note.tags)
            if s > 0:
                item = {
                    "type": "note",
                    "title": note.title,
                    "snippet": _extract_snippet(note.content, q),
                    "id": str(note.id),
                    "url": f"/notes/{note.id}",
                    "score": s,
                }
                results.append(item)
                grouped["notes"].append(item)

    # 7. Study Plans & Tasks
    if not filter_type or filter_type in ("all", "study_plans"):
        tasks = db.query(StudyTask).filter(StudyTask.user_id == current_user.id).all()
        for task in tasks:
            s = calc_score(task.topic) * 2 + calc_score(task.activity) + calc_score(task.reason)
            if s > 0:
                item = {
                    "type": "study_plan",
                    "title": f"Task: {task.topic}",
                    "snippet": f"Day {task.day_number} • {task.activity} ({task.duration_minutes}m)",
                    "id": str(task.id),
                    "url": "/study-plan",
                    "score": s,
                }
                results.append(item)
                grouped["study_plans"].append(item)

    # Sort results by score
    results.sort(key=lambda x: x["score"], reverse=True)

    return {
        "query": q,
        "total": len(results),
        "results": results[:25],
        "grouped": grouped,
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
