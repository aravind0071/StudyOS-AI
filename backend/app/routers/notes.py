"""
Notes Router — StudyOS AI
Full CRUD operations for student notes.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User, Note

router = APIRouter(prefix="/notes", tags=["Notes"])


class NoteCreate(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = None
    subject_id: Optional[str] = None
    unit_id: Optional[str] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    subject_id: Optional[str] = None
    unit_id: Optional[str] = None


@router.post("/", status_code=201)
def create_note(
    payload: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save an AI answer or custom note to Study Notes."""
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Note title cannot be empty.")

    note = Note(
        user_id=current_user.id,
        title=payload.title.strip(),
        content=payload.content,
        tags=payload.tags or [],
        subject_id=payload.subject_id,
        unit_id=payload.unit_id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return {
        "id": str(note.id),
        "title": note.title,
        "content": note.content,
        "tags": note.tags,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "message": "Note saved successfully.",
    }


@router.get("/")
def list_notes(
    search: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all notes saved by the current user."""
    query = db.query(Note).filter(Note.user_id == current_user.id)

    if subject_id:
        query = query.filter(Note.subject_id == subject_id)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(Note.title.ilike(s) | Note.content.ilike(s))

    notes = query.order_by(Note.created_at.desc()).all()

    return [
        {
            "id": str(n.id),
            "title": n.title,
            "content": n.content,
            "tags": n.tags,
            "subject_id": str(n.subject_id) if n.subject_id else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        }
        for n in notes
    ]


@router.get("/{note_id}")
def get_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single note by ID."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    return {
        "id": str(note.id),
        "title": note.title,
        "content": note.content,
        "tags": note.tags,
        "subject_id": str(note.subject_id) if note.subject_id else None,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
    }


@router.delete("/{note_id}")
def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a note."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully."}
