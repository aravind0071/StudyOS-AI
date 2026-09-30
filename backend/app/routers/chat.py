"""Chat router — AI Tutor with RAG."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User, ChatSession, ChatMessage
from app.services.rag_service import build_rag_response

router = APIRouter(prefix="/chat", tags=["AI Tutor"])


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    explain_level: Optional[str] = "btech_student"  # beginner/btech_student/exam/interview
    study_mode: Optional[str] = "learn"             # learn, exam, quiz, interview, revision, summary
    marks: Optional[int] = None                     # 2, 5, 10
    subject: Optional[str] = None
    unit: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    message_id: str
    answer: str
    sources: list
    used_external_knowledge: bool


@router.post("/", response_model=ChatResponse)
@router.post("/send", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to the AI Tutor. Returns RAG-grounded answer with citations."""

    # Get or create session
    if payload.session_id:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == payload.session_id, ChatSession.user_id == current_user.id)
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found.")
    else:
        session = ChatSession(
            user_id=current_user.id,
            title=payload.message[:80],
            subject=payload.subject,
        )
        db.add(session)
        db.flush()

    # Get conversation history
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(10)
        .all()
    )
    history_dicts = [{"role": m.role, "content": m.content} for m in history]

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="user",
        content=payload.message,
        explain_level=payload.explain_level,
    )
    db.add(user_msg)
    db.flush()

    # Build RAG response with study_mode, marks, and subject/unit prioritization
    rag_result = build_rag_response(
        query=payload.message,
        user_id=str(current_user.id),
        db=db,
        explain_level=payload.explain_level,
        study_mode=payload.study_mode or "learn",
        marks=payload.marks,
        subject=payload.subject,
        unit=payload.unit,
        session_history=history_dicts,
    )

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="assistant",
        content=rag_result["answer"],
        sources=rag_result["sources"],
        tokens_used=rag_result.get("tokens_used"),
    )
    db.add(assistant_msg)
    db.commit()

    return ChatResponse(
        session_id=str(session.id),
        message_id=str(assistant_msg.id),
        answer=rag_result["answer"],
        sources=rag_result["sources"],
        used_external_knowledge=rag_result["used_external_knowledge"],
    )


@router.post("/stream")
async def chat_stream(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream AI Tutor response with Server-Sent Events (SSE)."""
    from fastapi.responses import StreamingResponse
    import json
    from app.services.rag_service import stream_rag_tokens

    # Get or create session
    if payload.session_id:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == payload.session_id, ChatSession.user_id == current_user.id)
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found.")
    else:
        session = ChatSession(
            user_id=current_user.id,
            title=payload.message[:80],
            subject=payload.subject,
        )
        db.add(session)
        db.flush()

    # Get conversation history
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(10)
        .all()
    )
    history_dicts = [{"role": m.role, "content": m.content} for m in history]

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="user",
        content=payload.message,
        explain_level=payload.explain_level,
    )
    db.add(user_msg)
    db.flush()

    # Build RAG response
    rag_result = build_rag_response(
        query=payload.message,
        user_id=str(current_user.id),
        db=db,
        explain_level=payload.explain_level,
        study_mode=payload.study_mode or "learn",
        marks=payload.marks,
        subject=payload.subject,
        unit=payload.unit,
        session_history=history_dicts,
    )

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="assistant",
        content=rag_result["answer"],
        sources=rag_result["sources"],
        tokens_used=rag_result.get("tokens_used"),
    )
    db.add(assistant_msg)
    db.commit()

    async def sse_event_stream():
        start_data = {
            "type": "start",
            "session_id": str(session.id),
            "message_id": str(assistant_msg.id),
            "sources": rag_result["sources"],
            "used_external_knowledge": rag_result["used_external_knowledge"],
        }
        yield f"data: {json.dumps(start_data)}\n\n"

        async for token_chunk in stream_rag_tokens(rag_result["answer"]):
            token_data = {"type": "token", "token": token_chunk}
            yield f"data: {json.dumps(token_data)}\n\n"

        done_data = {
            "type": "done",
            "session_id": str(session.id),
            "message_id": str(assistant_msg.id),
        }
        yield f"data: {json.dumps(done_data)}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions")
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(20)
        .all()
    )
    return [
        {"id": str(s.id), "title": s.title, "created_at": s.created_at.isoformat() if s.created_at else None}
        for s in sessions
    ]


@router.get("/history/{session_id}")
def get_session_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "sources": m.sources,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.delete(session)
    db.commit()
    return {"message": "Chat session deleted successfully."}
