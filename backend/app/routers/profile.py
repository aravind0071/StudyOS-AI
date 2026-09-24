"""Profile router — user profile and settings management."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import verify_password, hash_password
from app.models.models import User, Profile, Concept, UserConceptMastery
import re

router = APIRouter(prefix="/profile", tags=["Profile"])


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str



class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    year_of_study: Optional[int] = None
    subjects: Optional[list[str]] = None
    goals: Optional[list[str]] = None
    daily_study_minutes: Optional[int] = None
    learning_level: Optional[str] = None
    explanation_style: Optional[str] = None


class CompleteOnboardingRequest(BaseModel):
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    year_of_study: Optional[int] = None
    subjects: list[str] = []
    goals: list[str] = []
    daily_study_minutes: int = 60


@router.get("/me")
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    # Concept mastery summary
    masteries = (
        db.query(UserConceptMastery, Concept)
        .join(Concept, UserConceptMastery.concept_id == Concept.id)
        .filter(UserConceptMastery.user_id == current_user.id)
        .all()
    )

    return {
        "id": str(current_user.id),
        "full_name": current_user.full_name,
        "email": current_user.email,
        "mobile": current_user.mobile,
        "college": profile.college if profile else None,
        "degree": profile.degree if profile else None,
        "branch": profile.branch if profile else None,
        "year_of_study": profile.year_of_study if profile else None,
        "subjects": profile.subjects if profile else [],
        "goals": profile.goals if profile else [],
        "daily_study_minutes": profile.daily_study_minutes if profile else 60,
        "learning_level": profile.learning_level if profile else "btech_student",
        "explanation_style": profile.explanation_style if profile else "balanced",
        "onboarding_completed": profile.onboarding_completed if profile else False,
        "profile": {
            "college": profile.college if profile else None,
            "degree": profile.degree if profile else None,
            "branch": profile.branch if profile else None,
            "year_of_study": profile.year_of_study if profile else None,
            "subjects": profile.subjects if profile else [],
            "goals": profile.goals if profile else [],
            "daily_study_minutes": profile.daily_study_minutes if profile else 60,
            "learning_level": profile.learning_level if profile else "btech_student",
            "explanation_style": profile.explanation_style if profile else "balanced",
            "onboarding_completed": profile.onboarding_completed if profile else False,
        } if profile else None,
        "mastery_count": len(masteries),
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.patch("/me")
def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.full_name:
        current_user.full_name = payload.full_name

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)

    update_fields = payload.model_dump(exclude_none=True)
    update_fields.pop("full_name", None)
    for field, value in update_fields.items():
        setattr(profile, field, value)

    db.commit()
    return {"message": "Profile updated successfully."}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    # Validate new password strength
    new_pw = payload.new_password
    if len(new_pw) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", new_pw):
        raise HTTPException(status_code=400, detail="New password must include at least one uppercase letter.")
    if not re.search(r"[a-z]", new_pw):
        raise HTTPException(status_code=400, detail="New password must include at least one lowercase letter.")
    if not re.search(r"\d", new_pw):
        raise HTTPException(status_code=400, detail="New password must include at least one number.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", new_pw):
        raise HTTPException(status_code=400, detail="New password must include at least one special character.")

    current_user.hashed_password = hash_password(new_pw)
    db.commit()
    return {"message": "Password changed successfully."}



@router.post("/onboarding")
def complete_onboarding(
    payload: CompleteOnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)

    profile.college = payload.college
    profile.degree = payload.degree
    profile.branch = payload.branch
    profile.year_of_study = payload.year_of_study
    profile.subjects = payload.subjects
    profile.goals = payload.goals
    profile.daily_study_minutes = payload.daily_study_minutes
    profile.onboarding_completed = True

    db.commit()
    return {"message": "Onboarding completed! Welcome to StudyOS AI."}


@router.get("/knowledge-graph")
def get_knowledge_graph(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return knowledge graph data for React Flow visualization."""
    from app.models.models import Concept, ConceptRelationship

    concepts = db.query(Concept).filter(Concept.user_id == current_user.id).all()
    relationships = (
        db.query(ConceptRelationship)
        .filter(ConceptRelationship.user_id == current_user.id)
        .all()
    )
    masteries = {
        str(m.concept_id): m.mastery_score
        for m, _ in db.query(UserConceptMastery, Concept)
        .join(Concept, UserConceptMastery.concept_id == Concept.id)
        .filter(UserConceptMastery.user_id == current_user.id)
        .all()
    }

    nodes = []
    for i, c in enumerate(concepts):
        mastery = masteries.get(str(c.id), 0)
        color = "#10b981" if mastery >= 80 else "#f59e0b" if mastery >= 50 else "#ef4444" if mastery > 0 else "#64748b"
        nodes.append({
            "id": str(c.id),
            "data": {
                "label": c.name,
                "mastery": round(mastery, 1),
                "description": c.description,
                "subject": c.subject,
            },
            "position": {"x": (i % 5) * 200, "y": (i // 5) * 150},
            "style": {"background": color, "color": "#fff", "border": "none", "borderRadius": "8px"},
        })

    edges = [
        {
            "id": str(r.id),
            "source": str(r.source_concept_id),
            "target": str(r.target_concept_id),
            "label": r.relationship_type,
            "style": {"stroke": "#475569"},
        }
        for r in relationships
    ]

    return {"nodes": nodes, "edges": edges}
