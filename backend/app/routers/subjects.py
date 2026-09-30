"""
Subjects, Units, and Resources Router — StudyOS AI
Implements hierarchical Subject -> Unit -> Resource knowledge architecture.
Strictly enforces User Data Isolation on every query.
"""

import logging
import uuid
import os
import mimetypes
from typing import Optional, List
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_flexible
from app.models.models import User, Subject, Unit, Resource, Material, MaterialType, ProcessingStatus, MaterialChunk

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/subjects", tags=["Subjects & Resources"])


# ─── PYDANTIC SCHEMAS ─────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = "📚"
    color: Optional[str] = "indigo"
    target_exam_date: Optional[str] = None
    initial_units_count: Optional[int] = 5  # Standard 5 units by default


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    target_exam_date: Optional[str] = None
    progress_percent: Optional[float] = None


class UnitCreate(BaseModel):
    unit_number: int
    title: str
    description: Optional[str] = None


class UnitUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    progress_percent: Optional[float] = None
    is_completed: Optional[bool] = None


class ResourceCreate(BaseModel):
    subject_id: Optional[str] = None
    unit_id: Optional[str] = None
    title: str
    resource_type: str  # image, video, lecture, youtube, pdf, document, notes, external_link
    description: Optional[str] = None
    url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: Optional[List[str]] = None


# ─── DEFAULT SUBJECT SEED TEMPLATES ──────────────────────────────────────────

DEFAULT_SUBJECT_TEMPLATES = [
    {
        "name": "Operating Systems",
        "code": "CS401",
        "icon": "💻",
        "color": "indigo",
        "description": "Core concepts of process scheduling, synchronization, memory management, and file systems.",
        "units": [
            {"unit_number": 1, "title": "Introduction & System Structures", "description": "OS Services, System Calls, OS Structures, Virtual Machines"},
            {"unit_number": 2, "title": "Process Management & CPU Scheduling", "description": "Process Concept, Threads, FCFS, SJF, Round Robin, Multi-level Queues"},
            {"unit_number": 3, "title": "Process Synchronization & Deadlocks", "description": "Critical Section Problem, Peterson's Solution, Semaphores, Bankers Algorithm"},
            {"unit_number": 4, "title": "Memory Management & Virtual Memory", "description": "Paging, Segmentation, Demand Paging, Page Replacement Algorithms (FIFO, LRU)"},
            {"unit_number": 5, "title": "Storage & File System Implementation", "description": "File Concept, Directory Structures, Disk Scheduling (SSTF, SCAN, C-SCAN)"},
        ],
    },
    {
        "name": "Computer Networks",
        "code": "CS402",
        "icon": "🌐",
        "color": "sky",
        "description": "OSI and TCP/IP protocol stacks, routing algorithms, error control, and socket programming.",
        "units": [
            {"unit_number": 1, "title": "Physical & Data Link Layer", "description": "Framing, Error Detection (Checksum, CRC), Flow Control (Sliding Window)"},
            {"unit_number": 2, "title": "Medium Access Control (MAC)", "description": "ALOHA, CSMA/CD, CSMA/CA, Ethernet Standards, Collision Resolution"},
            {"unit_number": 3, "title": "Network Layer & Routing Protocols", "description": "IPv4/IPv6 Addressing, Subnetting, Distance Vector, Link State Routing (OSPF, BGP)"},
            {"unit_number": 4, "title": "Transport Layer & Congestion Control", "description": "TCP vs UDP, 3-Way Handshake, TCP Flow Control, AIMD, Leaky Bucket"},
            {"unit_number": 5, "title": "Application Layer & Network Security", "description": "DNS, HTTP, SMTP, SSL/TLS, Public Key Cryptography, Firewalls"},
        ],
    },
    {
        "name": "Database Management Systems",
        "code": "CS403",
        "icon": "🗄️",
        "color": "emerald",
        "description": "Relational data modeling, SQL queries, normalization, transactions, and indexing.",
        "units": [
            {"unit_number": 1, "title": "Database Architecture & ER Modeling", "description": "Three-Schema Architecture, Data Independence, Entities, Relationships, Keys"},
            {"unit_number": 2, "title": "Relational Algebra & Advanced SQL", "description": "Select, Project, Joins, Aggregate Functions, Nested Subqueries, Views"},
            {"unit_number": 3, "title": "Relational Schema Normalization", "description": "Functional Dependencies, 1NF, 2NF, 3NF, BCNF, Lossless Join Decomposition"},
            {"unit_number": 4, "title": "Transaction Processing & Concurrency", "description": "ACID Properties, Serializability, Two-Phase Locking (2PL), Deadlock Handling"},
            {"unit_number": 5, "title": "Storage, Indexing & Query Optimization", "description": "B-Trees, B+ Trees, Hashing Techniques, Query Execution Plans"},
        ],
    },
    {
        "name": "Machine Learning",
        "code": "CS501",
        "icon": "🧠",
        "color": "purple",
        "description": "Supervised, unsupervised algorithms, model evaluation, and neural networks.",
        "units": [
            {"unit_number": 1, "title": "Foundations & Linear Models", "description": "Linear Regression, Cost Functions, Gradient Descent, Logistic Regression"},
            {"unit_number": 2, "title": "Classification & Decision Trees", "description": "Entropy, Information Gain, ID3/C4.5, Random Forests, Support Vector Machines"},
            {"unit_number": 3, "title": "Unsupervised Learning & Clustering", "description": "K-Means, Hierarchical Clustering, PCA Dimensionality Reduction"},
            {"unit_number": 4, "title": "Neural Networks & Deep Learning", "description": "Perceptron, Multi-Layer Perceptrons, Backpropagation, Activation Functions"},
            {"unit_number": 5, "title": "Model Evaluation & Regularization", "description": "Cross-Validation, Precision, Recall, F1-Score, ROC/AUC, L1/L2 Regularization"},
        ],
    },
]


def seed_default_subjects(current_user: User, db: Session):
    """Seed standard B.Tech curriculum subjects (OS, Networks, DBMS, ML) with Units 1-5."""
    for tmpl in DEFAULT_SUBJECT_TEMPLATES:
        existing = (
            db.query(Subject)
            .filter(Subject.user_id == current_user.id, Subject.name == tmpl["name"])
            .first()
        )
        if not existing:
            subj = Subject(
                user_id=current_user.id,
                name=tmpl["name"],
                code=tmpl.get("code"),
                icon=tmpl.get("icon", "📚"),
                color=tmpl.get("color", "indigo"),
                description=tmpl.get("description"),
                progress_percent=0.0,
            )
            db.add(subj)
            db.flush()
            for u in tmpl.get("units", []):
                unit = Unit(
                    subject_id=subj.id,
                    user_id=current_user.id,
                    unit_number=u["unit_number"],
                    title=u["title"],
                    description=u.get("description", ""),
                    progress_percent=0.0,
                )
                db.add(unit)
    db.commit()


# ─── SUBJECT ENDPOINTS ────────────────────────────────────────────────────────

@router.post("/seed-curriculum")
@router.post("/seed-curriculum/")
def seed_curriculum(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Explicitly seed core B.Tech subjects for the current user."""
    seed_default_subjects(current_user=current_user, db=db)
    return {"message": "Standard B.Tech curriculum seeded successfully!"}


@router.get("")
@router.get("/")
def list_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all subjects belonging to the current authenticated user."""
    subjects = (
        db.query(Subject)
        .filter(Subject.user_id == current_user.id)
        .order_by(Subject.created_at.asc())
        .all()
    )

    # Auto-seed standard curriculum subjects if the user has 0 subjects
    if len(subjects) == 0:
        seed_default_subjects(current_user=current_user, db=db)
        subjects = (
            db.query(Subject)
            .filter(Subject.user_id == current_user.id)
            .order_by(Subject.created_at.asc())
            .all()
        )

    results = []
    for s in subjects:
        unit_count = len(s.units)
        resource_count = len(s.resources)
        results.append({
            "id": str(s.id),
            "name": s.name,
            "code": s.code,
            "description": s.description,
            "icon": s.icon,
            "color": s.color,
            "target_exam_date": s.target_exam_date.isoformat() if s.target_exam_date else None,
            "progress_percent": s.progress_percent,
            "unit_count": unit_count,
            "units_count": unit_count,
            "resource_count": resource_count,
            "resources_count": resource_count,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new dynamically configurable subject with default units."""
    exam_dt = None
    if payload.target_exam_date:
        try:
            exam_dt = datetime.fromisoformat(payload.target_exam_date.replace("Z", "+00:00"))
        except Exception:
            pass

    subject = Subject(
        user_id=current_user.id,
        name=payload.name.strip(),
        code=payload.code.strip() if payload.code else None,
        description=payload.description.strip() if payload.description else None,
        icon=payload.icon or "📚",
        color=payload.color or "indigo",
        target_exam_date=exam_dt,
        progress_percent=0.0,
    )
    db.add(subject)
    db.flush()

    # Scaffold initial units
    units_to_create = max(1, min(payload.initial_units_count or 5, 12))
    for u_idx in range(1, units_to_create + 1):
        unit = Unit(
            subject_id=subject.id,
            user_id=current_user.id,
            unit_number=u_idx,
            title=f"Unit {u_idx}",
            description=f"Curriculum topics and learning resources for Unit {u_idx}",
            progress_percent=0.0,
        )
        db.add(unit)

    db.commit()
    db.refresh(subject)

    return {
        "message": f"Subject '{subject.name}' created with {units_to_create} units.",
        "id": str(subject.id),
        "name": subject.name,
    }


@router.get("/{subject_id}")
def get_subject_detail(
    subject_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full details of a specific subject, including units and resources breakdown."""
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == current_user.id)
        .first()
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    units_data = []
    total_unit_progress = 0.0
    for u in subject.units:
        raw_res_list = [r for r in subject.resources if str(r.unit_id) == str(u.id)]
        type_counts = {}
        formatted_unit_resources = []
        for r in raw_res_list:
            type_counts[r.resource_type] = type_counts.get(r.resource_type, 0) + 1
            formatted_unit_resources.append({
                "id": str(r.id),
                "unit_id": str(r.unit_id) if r.unit_id else None,
                "title": r.title,
                "resource_type": r.resource_type,
                "type": r.resource_type,
                "description": r.description,
                "url": r.url,
                "thumbnail_url": r.thumbnail_url,
                "file_size_bytes": r.file_size_bytes,
                "file_type": r.file_type,
                "tags": r.tags or [],
                "processing_status": r.processing_status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        units_data.append({
            "id": str(u.id),
            "unit_number": u.unit_number,
            "title": u.title,
            "description": u.description,
            "progress_percent": u.progress_percent,
            "is_completed": u.is_completed,
            "resource_count": len(formatted_unit_resources),
            "resource_types": type_counts,
            "resources": formatted_unit_resources,
        })
        total_unit_progress += u.progress_percent

    overall_progress = round(total_unit_progress / max(1, len(subject.units)), 1)
    if subject.progress_percent != overall_progress:
        subject.progress_percent = overall_progress
        db.commit()

    # Group all resources
    resources_data = [
        {
            "id": str(r.id),
            "unit_id": str(r.unit_id) if r.unit_id else None,
            "title": r.title,
            "type": r.resource_type,
            "description": r.description,
            "url": r.url,
            "thumbnail_url": r.thumbnail_url,
            "file_size_bytes": r.file_size_bytes,
            "file_type": r.file_type,
            "tags": r.tags or [],
            "processing_status": r.processing_status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in subject.resources
    ]

    detail_data = {
        "id": str(subject.id),
        "name": subject.name,
        "code": subject.code,
        "description": subject.description,
        "icon": subject.icon,
        "color": subject.color,
        "target_exam_date": subject.target_exam_date.isoformat() if subject.target_exam_date else None,
        "progress_percent": subject.progress_percent,
        "units": units_data,
        "resources": resources_data,
        "total_resources": len(resources_data),
    }
    return {**detail_data, "subject": detail_data}


@router.patch("/{subject_id}")
def update_subject(
    subject_id: str,
    payload: SubjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == current_user.id)
        .first()
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if payload.name is not None:
        subject.name = payload.name.strip()
    if payload.code is not None:
        subject.code = payload.code.strip()
    if payload.description is not None:
        subject.description = payload.description.strip()
    if payload.icon is not None:
        subject.icon = payload.icon
    if payload.color is not None:
        subject.color = payload.color
    if payload.target_exam_date is not None:
        try:
            subject.target_exam_date = datetime.fromisoformat(payload.target_exam_date.replace("Z", "+00:00"))
        except Exception:
            pass
    if payload.progress_percent is not None:
        subject.progress_percent = max(0.0, min(100.0, payload.progress_percent))

    db.commit()
    db.refresh(subject)
    return {"message": "Subject updated successfully.", "id": str(subject.id)}


@router.delete("/{subject_id}")
def delete_subject(
    subject_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == current_user.id)
        .first()
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    db.delete(subject)
    db.commit()
    return {"message": f"Subject '{subject.name}' deleted successfully."}


# ─── UNIT ENDPOINTS ──────────────────────────────────────────────────────────

@router.post("/{subject_id}/units", status_code=status.HTTP_201_CREATED)
def add_unit(
    subject_id: str,
    payload: UnitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == current_user.id)
        .first()
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    unit = Unit(
        subject_id=subject.id,
        user_id=current_user.id,
        unit_number=payload.unit_number,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        progress_percent=0.0,
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)

    return {"message": "Unit created successfully.", "id": str(unit.id), "unit_number": unit.unit_number}


@router.patch("/units/{unit_id}")
def update_unit(
    unit_id: str,
    payload: UnitUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unit = (
        db.query(Unit)
        .filter(Unit.id == unit_id, Unit.user_id == current_user.id)
        .first()
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found.")

    if payload.title is not None:
        unit.title = payload.title.strip()
    if payload.description is not None:
        unit.description = payload.description.strip()
    if payload.progress_percent is not None:
        unit.progress_percent = max(0.0, min(100.0, payload.progress_percent))
        if unit.progress_percent >= 100.0:
            unit.is_completed = True
    if payload.is_completed is not None:
        unit.is_completed = payload.is_completed
        if payload.is_completed and unit.progress_percent < 100.0:
            unit.progress_percent = 100.0

    db.commit()

    # Recalculate parent subject progress
    subject = db.query(Subject).filter(Subject.id == unit.subject_id).first()
    if subject and len(subject.units) > 0:
        subject.progress_percent = round(sum(u.progress_percent for u in subject.units) / len(subject.units), 1)
        db.commit()

    return {"message": "Unit updated successfully.", "progress_percent": unit.progress_percent}


@router.delete("/units/{unit_id}")
def delete_unit(
    unit_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unit = (
        db.query(Unit)
        .filter(Unit.id == unit_id, Unit.user_id == current_user.id)
        .first()
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found.")

    db.delete(unit)
    db.commit()
    return {"message": "Unit deleted successfully."}


# ─── RESOURCE ENDPOINTS ──────────────────────────────────────────────────────

@router.post("/{subject_id}/resources", status_code=status.HTTP_201_CREATED)
def add_subject_resource(
    subject_id: str,
    payload: ResourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a resource (link, youtube, notes, external lecture) with metadata to a subject and unit."""
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == current_user.id)
        .first()
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    # Validate unit ownership if provided
    unit_id = None
    if payload.unit_id:
        unit = db.query(Unit).filter(Unit.id == payload.unit_id, Unit.subject_id == subject.id).first()
        if unit:
            unit_id = unit.id

    # Auto-extract youtube thumbnail if youtube type
    thumbnail = payload.thumbnail_url
    if payload.resource_type == "youtube" and payload.url:
        import re
        match = re.search(r'(?:v=|\/shorts\/|\/embed\/|\/v\/|youtu\.be\/)([0-9A-Za-z_-]{11})', payload.url)
        if match:
            vid = match.group(1)
            thumbnail = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"

    resource = Resource(
        user_id=current_user.id,
        subject_id=subject.id,
        unit_id=unit_id,
        title=payload.title.strip(),
        resource_type=payload.resource_type.lower(),
        description=payload.description.strip() if payload.description else None,
        url=payload.url.strip() if payload.url else None,
        thumbnail_url=thumbnail,
        tags=payload.tags or [],
        owner_name=current_user.full_name,
        processing_status="ready",
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    return {
        "message": f"Resource '{resource.title}' added successfully.",
        "id": str(resource.id),
        "type": resource.resource_type,
    }


@router.post("/resources", status_code=status.HTTP_201_CREATED)
def add_resource_direct(
    payload: ResourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add resource when subject_id is supplied in the request body."""
    if not payload.subject_id:
        raise HTTPException(status_code=400, detail="subject_id is required in request body.")
    return add_subject_resource(
        subject_id=payload.subject_id,
        payload=payload,
        current_user=current_user,
        db=db,
    )


@router.post("/{subject_id}/upload-resource", status_code=status.HTTP_201_CREATED)
async def upload_subject_file_resource(
    subject_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    unit_id: Optional[str] = Form(None),
    resource_type: Optional[str] = Form("pdf"),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a file (PDF, DOCX, PPTX, Image) directly into a Subject and Unit."""
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == current_user.id)
        .first()
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    # Save file
    user_dir = Path(settings.UPLOAD_DIR) / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}_{file.filename or 'upload'}"
    file_path = user_dir / unique_name
    content = await file.read()
    file_path.write_bytes(content)

    # Map file type
    ext = Path(file.filename or "").suffix.lower()
    res_type = resource_type or "document"
    if ext in [".pdf"]:
        res_type = "pdf"
    elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
        res_type = "image"
    elif ext in [".mp4", ".mov", ".mkv"]:
        res_type = "video"
    elif ext in [".pptx", ".ppt", ".docx", ".doc"]:
        res_type = "document"

    resource = Resource(
        user_id=current_user.id,
        subject_id=subject.id,
        unit_id=unit_id if unit_id else None,
        title=title.strip(),
        resource_type=res_type,
        description=description,
        file_path=str(file_path),
        file_size_bytes=len(content),
        file_type=file.content_type,
        tags=[subject.name, ext.replace(".", "").upper()],
        owner_name=current_user.full_name,
        processing_status="processing",
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    # Also register as Material so RAG chunking and vector retrieval index it!
    mat_type_map = {
        ".pdf": MaterialType.PDF,
        ".docx": MaterialType.DOCX,
        ".doc": MaterialType.DOCX,
        ".pptx": MaterialType.PPTX,
        ".ppt": MaterialType.PPTX,
        ".png": MaterialType.IMAGE,
        ".jpg": MaterialType.IMAGE,
        ".jpeg": MaterialType.IMAGE,
    }
    if ext in mat_type_map:
        mat = Material(
            user_id=current_user.id,
            title=title.strip(),
            material_type=mat_type_map[ext],
            file_path=str(file_path),
            file_size_bytes=len(content),
            mime_type=file.content_type,
            subject=subject.name,
            course=subject.code,
            processing_status=ProcessingStatus.PENDING,
        )
        db.add(mat)
        db.commit()
        db.refresh(mat)

        resource.material_id = mat.id
        db.commit()

        # Trigger background processing
        try:
            from app.routers.materials import _process_material_background
            background_tasks.add_task(_process_material_background, str(mat.id), settings.DATABASE_URL)
        except Exception as e:
            logger.warning(f"Background task enqueue failed: {e}")

    return {
        "message": f"Resource uploaded to {subject.name}.",
        "id": str(resource.id),
        "type": resource.resource_type,
        "processing_status": "processing",
    }


@router.post("/resources/upload", status_code=status.HTTP_201_CREATED)
async def upload_resource_direct(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    title: Optional[str] = Form(None),
    unit_id: Optional[str] = Form(None),
    resource_type: Optional[str] = Form("pdf"),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload resource directly when subject_id is supplied as a form field."""
    return await upload_subject_file_resource(
        subject_id=subject_id,
        background_tasks=background_tasks,
        file=file,
        title=title or (file.filename or "upload").rsplit(".", 1)[0],
        unit_id=unit_id,
        resource_type=resource_type,
        description=description,
        current_user=current_user,
        db=db,
    )


@router.delete("/resources/{resource_id}")
def delete_resource(
    resource_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resource = (
        db.query(Resource)
        .filter(Resource.id == resource_id, Resource.user_id == current_user.id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    # Remove underlying file if stored locally
    if resource.file_path:
        try:
            p = Path(resource.file_path)
            if p.exists():
                p.unlink(missing_ok=True)
        except Exception:
            pass

    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully."}


@router.get("/resources/{resource_id}/file")
def get_resource_file(
    resource_id: str,
    token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user_flexible),
    db: Session = Depends(get_db),
):
    """Serve or stream resource file inline in browser, or redirect to URL."""
    resource = (
        db.query(Resource)
        .filter(Resource.id == resource_id, Resource.user_id == current_user.id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    target_file = None
    if resource.file_path:
        p = Path(resource.file_path)
        if p.exists():
            target_file = p
        else:
            alt_p = Path(settings.BACKEND_DIR) / resource.file_path
            if alt_p.exists():
                target_file = alt_p

    # Check linked material
    if not target_file and resource.material_id:
        mat = db.query(Material).filter(Material.id == resource.material_id, Material.user_id == current_user.id).first()
        if mat and mat.file_path:
            p = Path(mat.file_path)
            if p.exists():
                target_file = p
            else:
                alt_p = Path(settings.BACKEND_DIR) / mat.file_path
                if alt_p.exists():
                    target_file = alt_p

    if target_file and target_file.exists():
        ext = target_file.suffix.lower()
        guessed_mime = mimetypes.guess_type(str(target_file))[0]
        mime_fallbacks = {
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".mp3": "audio/mpeg",
            ".mp4": "video/mp4",
        }
        media_type = guessed_mime or mime_fallbacks.get(ext, "application/octet-stream")
        display_name = resource.title or target_file.name
        if not display_name.lower().endswith(ext):
            display_name = f"{display_name}{ext}"

        return FileResponse(
            path=str(target_file),
            media_type=media_type,
            filename=display_name,
            content_disposition_type="inline",
        )

    if resource.url:
        return RedirectResponse(url=resource.url)

    raise HTTPException(status_code=404, detail="No downloadable or viewable file attached to this resource.")


@router.get("/resources/{resource_id}/content")
def get_resource_content(
    resource_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full text/slides/details for a resource."""
    resource = (
        db.query(Resource)
        .filter(Resource.id == resource_id, Resource.user_id == current_user.id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    chunks = []
    if resource.material_id:
        chunks = (
            db.query(MaterialChunk)
            .filter(MaterialChunk.material_id == resource.material_id)
            .order_by(MaterialChunk.chunk_index.asc())
            .all()
        )

    has_file = bool(resource.file_path and os.path.exists(resource.file_path))
    if not has_file and resource.file_path:
        has_file = (Path(settings.BACKEND_DIR) / resource.file_path).exists()

    return {
        "id": str(resource.id),
        "title": resource.title,
        "resource_type": resource.resource_type,
        "description": resource.description,
        "url": resource.url,
        "has_file": has_file,
        "file_url": f"/api/v1/subjects/resources/{resource.id}/file" if has_file else resource.url,
        "tags": resource.tags or [],
        "chunks": [
            {
                "id": str(c.id),
                "chunk_index": c.chunk_index,
                "page_number": c.page_number,
                "content": c.content,
                "section_title": c.section_title,
                "timestamp_start": c.timestamp_start,
            }
            for c in chunks
        ],
    }


# ─── SEED DEFAULT CURRICULUM HELPER ──────────────────────────────────────────

@router.post("/seed-defaults")
def seed_default_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seed comprehensive standard engineering subjects for the student."""
    created_count = 0
    for tmpl in DEFAULT_SUBJECT_TEMPLATES:
        existing = (
            db.query(Subject)
            .filter(Subject.user_id == current_user.id, Subject.name == tmpl["name"])
            .first()
        )
        if existing:
            continue

        subj = Subject(
            user_id=current_user.id,
            name=tmpl["name"],
            code=tmpl["code"],
            description=tmpl["description"],
            icon=tmpl["icon"],
            color=tmpl["color"],
            progress_percent=0.0,
        )
        db.add(subj)
        db.flush()

        for u in tmpl["units"]:
            unit = Unit(
                subject_id=subj.id,
                user_id=current_user.id,
                unit_number=u["unit_number"],
                title=u["title"],
                description=u["description"],
                progress_percent=0.0,
            )
            db.add(unit)

        created_count += 1

    db.commit()
    return {"message": f"Seeded {created_count} default academic subjects.", "count": created_count}
