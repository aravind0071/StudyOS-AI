"""Materials router — upload, list, and manage learning materials."""

import os
import uuid
import logging
import mimetypes
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import User, Material, MaterialType, ProcessingStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/materials", tags=["Materials"])

ALLOWED_EXTENSIONS = {
    ".pdf": MaterialType.PDF,
    ".docx": MaterialType.DOCX,
    ".doc": MaterialType.DOCX,
    ".pptx": MaterialType.PPTX,
    ".ppt": MaterialType.PPTX,
    ".png": MaterialType.IMAGE,
    ".jpg": MaterialType.IMAGE,
    ".jpeg": MaterialType.IMAGE,
    ".webp": MaterialType.IMAGE,
    ".mp3": MaterialType.AUDIO,
    ".wav": MaterialType.AUDIO,
    ".m4a": MaterialType.AUDIO,
    ".mp4": MaterialType.AUDIO,
}


def _validate_file(file: UploadFile) -> tuple[str, MaterialType]:
    """Validate file type and size. Returns (extension, material_type)."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{ext}' is not supported. Allowed: PDF, DOCX, PPTX, images, audio.",
        )
    return ext, ALLOWED_EXTENSIONS[ext]


def _save_file(file_content: bytes, user_id: str, filename: str) -> tuple[str, int]:
    """Save uploaded file to user's upload directory. Returns (file_path, size)."""
    user_dir = Path(settings.UPLOAD_DIR) / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = user_dir / unique_name
    file_path.write_bytes(file_content)
    return str(file_path), len(file_content)


async def _process_material_background(material_id: str, db_url: str):
    """
    Background task: extract text, chunk, generate embeddings, identify concepts.
    This is where the AI ingestion pipeline runs.
    """
    # Import here to avoid circular imports in lightweight contexts
    try:
        from app.services.ingestion_service import process_material
        await process_material(material_id, db_url)
    except Exception as e:
        logger.error(f"Background processing failed for material {material_id}: {e}")


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_material(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    subject: Optional[str] = Form(None),
    course: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a learning material. Triggers background AI processing."""
    ext, material_type = _validate_file(file)

    # Read and check file size
    content = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the {settings.MAX_FILE_SIZE_MB}MB limit.",
        )

    # Save file
    file_path, file_size = _save_file(content, str(current_user.id), file.filename or "upload")

    # Create material record
    material = Material(
        user_id=current_user.id,
        title=title.strip(),
        material_type=material_type,
        file_path=file_path,
        file_size_bytes=file_size,
        mime_type=file.content_type,
        subject=subject,
        course=course,
        processing_status=ProcessingStatus.PENDING,
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    # Trigger background processing
    background_tasks.add_task(
        _process_material_background,
        str(material.id),
        settings.DATABASE_URL,
    )

    return {
        "message": "Material uploaded successfully. AI processing has started.",
        "material_id": str(material.id),
        "title": material.title,
        "type": material.material_type.value,
        "status": material.processing_status.value,
    }


@router.post("/add-url", status_code=status.HTTP_201_CREATED)
async def add_url_material(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    title: Optional[str] = Form(None),
    url_type: Optional[str] = Form(None),  # "youtube" or "website"
    subject: Optional[str] = Form(None),
    course: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a YouTube video or website URL as a learning material with auto-detection."""
    import re
    url_clean = url.strip()
    if not url_clean:
        raise HTTPException(status_code=400, detail="URL cannot be empty.")

    # Auto-detect or map material type
    lowered = url_clean.lower()
    if (url_type and url_type.lower() == "youtube") or "youtube.com" in lowered or "youtu.be" in lowered:
        mat_type = MaterialType.YOUTUBE
    else:
        mat_type = MaterialType.WEBSITE

    # Smart fallback title if user leaves title blank
    clean_title = (title or "").strip()
    if not clean_title:
        if mat_type == MaterialType.YOUTUBE:
            match = re.search(r'(?:v=|\/shorts\/|\/embed\/|\/v\/|youtu\.be\/)([0-9A-Za-z_-]{11})', url_clean)
            vid = match.group(1) if match else None
            clean_title = f"YouTube Video ({vid})" if vid else "YouTube Video"
        else:
            try:
                from urllib.parse import urlparse
                domain = urlparse(url_clean).netloc.replace("www.", "")
                clean_title = f"Article from {domain}" if domain else "Website Article"
            except Exception:
                clean_title = "Website Article"

    material = Material(
        user_id=current_user.id,
        title=clean_title,
        material_type=mat_type,
        source_url=url_clean,
        subject=subject,
        course=course,
        processing_status=ProcessingStatus.PENDING,
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    background_tasks.add_task(
        _process_material_background,
        str(material.id),
        settings.DATABASE_URL,
    )

    return {
        "message": "URL added successfully. AI processing has started.",
        "material_id": str(material.id),
        "status": material.processing_status.value,
        "title": clean_title,
    }


@router.get("/")
def list_materials(
    subject: Optional[str] = None,
    material_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all materials for the authenticated user."""
    query = db.query(Material).filter(Material.user_id == current_user.id)
    if subject:
        query = query.filter(Material.subject.ilike(f"%{subject}%"))
    if material_type:
        query = query.filter(Material.material_type == material_type)

    materials = query.order_by(Material.created_at.desc()).all()

    return [
        {
            "id": str(m.id),
            "title": m.title,
            "type": m.material_type.value,
            "subject": m.subject,
            "course": m.course,
            "status": m.processing_status.value,
            "detected_topics": m.detected_topics,
            "file_size_bytes": m.file_size_bytes,
            "page_count": m.page_count,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in materials
    ]


@router.get("/{material_id}")
def get_material(
    material_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get details of a specific material (user-scoped)."""
    material = (
        db.query(Material)
        .filter(Material.id == material_id, Material.user_id == current_user.id)
        .first()
    )
    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")

    return {
        "id": str(material.id),
        "title": material.title,
        "type": material.material_type.value,
        "subject": material.subject,
        "course": material.course,
        "status": material.processing_status.value,
        "detected_topics": material.detected_topics,
        "page_count": material.page_count,
        "file_size_bytes": material.file_size_bytes,
        "source_url": material.source_url,
        "created_at": material.created_at.isoformat() if material.created_at else None,
    }


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a material and its associated data (user-scoped)."""
    material = (
        db.query(Material)
        .filter(Material.id == material_id, Material.user_id == current_user.id)
        .first()
    )
    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")

    # Delete file from disk
    if material.file_path and os.path.exists(material.file_path):
        os.remove(material.file_path)

    db.delete(material)
    db.commit()


@router.post("/{material_id}/retry")
def retry_material_processing(
    material_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-trigger background processing for a failed or pending material."""
    material = (
        db.query(Material)
        .filter(Material.id == material_id, Material.user_id == current_user.id)
        .first()
    )
    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")

    material.processing_status = ProcessingStatus.PENDING
    material.processing_error = None
    db.commit()

    background_tasks.add_task(
        _process_material_background,
        str(material.id),
        settings.DATABASE_URL,
    )
    return {"message": "Re-processing started.", "status": "pending"}
