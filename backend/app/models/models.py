"""
StudyOS AI — Database Models
All models use user_id as foreign key to enforce data isolation.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Float,
    ForeignKey, Text, JSON, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


# ─── ENUMS ────────────────────────────────────────────────────────────────────

class OTPPurpose(str, enum.Enum):
    REGISTRATION = "registration"
    LOGIN = "login"
    PASSWORD_RESET = "password_reset"


class MaterialType(str, enum.Enum):
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    IMAGE = "image"
    AUDIO = "audio"
    YOUTUBE = "youtube"
    WEBSITE = "website"


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class QuizType(str, enum.Enum):
    MCQ = "mcq"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    INTERVIEW = "interview"


class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class GoalType(str, enum.Enum):
    SEMESTER_EXAMS = "semester_exams"
    PLACEMENTS = "placements"
    COMPETITIVE_EXAMS = "competitive_exams"
    INTERVIEWS = "interviews"
    GENERAL_LEARNING = "general_learning"


# ─── USERS ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    mobile = Column(String(15), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=False)  # activated after OTP
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    profile = relationship("Profile", back_populates="user", uselist=False)
    materials = relationship("Material", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    quiz_attempts = relationship("QuizAttempt", back_populates="user")
    study_plans = relationship("StudyPlan", back_populates="user")
    concept_masteries = relationship("UserConceptMastery", back_populates="user")
    interview_sessions = relationship("InterviewSession", back_populates="user")
    otp_verifications = relationship("OTPVerification", back_populates="user")
    subjects = relationship("Subject", back_populates="user", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="user", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="user", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    notification_settings = relationship("UserNotificationSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    college = Column(String(255), nullable=True)
    degree = Column(String(100), nullable=True)
    branch = Column(String(100), nullable=True)
    year_of_study = Column(Integer, nullable=True)
    subjects = Column(JSON, default=list)           # list of subject strings
    goals = Column(JSON, default=list)              # list of GoalType strings
    daily_study_minutes = Column(Integer, default=60)
    learning_level = Column(String(50), default="btech_student")
    explanation_style = Column(String(50), default="balanced")
    avatar_url = Column(String(500), nullable=True)
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="profile")


# ─── OTP ─────────────────────────────────────────────────────────────────────

class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    purpose = Column(SAEnum(OTPPurpose), nullable=False)
    otp_hash = Column(String(255), nullable=False)  # SHA-256 hash of OTP
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0)
    is_used = Column(Boolean, default=False)
    last_sent_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="otp_verifications")


# ─── MATERIALS ────────────────────────────────────────────────────────────────

class Material(Base):
    __tablename__ = "materials"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String(500), nullable=False)
    material_type = Column(SAEnum(MaterialType), nullable=False)
    file_path = Column(String(1000), nullable=True)   # local storage path
    source_url = Column(String(2000), nullable=True)  # YouTube / website URL
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    subject = Column(String(200), nullable=True)
    course = Column(String(200), nullable=True)
    processing_status = Column(SAEnum(ProcessingStatus), default=ProcessingStatus.PENDING)
    processing_error = Column(Text, nullable=True)
    detected_topics = Column(JSON, default=list)   # list of topic strings
    page_count = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)  # for audio/video
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="materials")
    chunks = relationship("MaterialChunk", back_populates="material", cascade="all, delete-orphan")


class MaterialChunk(Base):
    __tablename__ = "material_chunks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id = Column(String(36), ForeignKey("materials.id", ondelete="CASCADE"), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    section_title = Column(String(500), nullable=True)
    timestamp_start = Column(Float, nullable=True)   # seconds, for audio/video
    timestamp_end = Column(Float, nullable=True)
    token_count = Column(Integer, nullable=True)
    # pgvector embedding stored separately in embeddings table
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    material = relationship("Material", back_populates="chunks")


# ─── CONCEPTS / KNOWLEDGE GRAPH ───────────────────────────────────────────────

class Concept(Base):
    __tablename__ = "concepts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(200), nullable=True)
    source_material_ids = Column(JSON, default=list)  # list of material UUIDs
    position_x = Column(Float, default=0.0)  # React Flow position
    position_y = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    masteries = relationship("UserConceptMastery", back_populates="concept")
    outgoing_relationships = relationship(
        "ConceptRelationship",
        foreign_keys="ConceptRelationship.source_concept_id",
        back_populates="source_concept"
    )
    incoming_relationships = relationship(
        "ConceptRelationship",
        foreign_keys="ConceptRelationship.target_concept_id",
        back_populates="target_concept"
    )


class ConceptRelationship(Base):
    __tablename__ = "concept_relationships"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_concept_id = Column(String(36), ForeignKey("concepts.id", ondelete="CASCADE"))
    target_concept_id = Column(String(36), ForeignKey("concepts.id", ondelete="CASCADE"))
    relationship_type = Column(String(100), default="related_to")  # e.g., "is_part_of", "leads_to"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source_concept = relationship("Concept", foreign_keys=[source_concept_id], back_populates="outgoing_relationships")
    target_concept = relationship("Concept", foreign_keys=[target_concept_id], back_populates="incoming_relationships")


class UserConceptMastery(Base):
    __tablename__ = "user_concept_mastery"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    concept_id = Column(String(36), ForeignKey("concepts.id", ondelete="CASCADE"))
    mastery_score = Column(Float, default=0.0)    # 0-100 estimated mastery
    quiz_attempts_count = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    wrong_answers = Column(Integer, default=0)
    last_revised_at = Column(DateTime(timezone=True), nullable=True)
    next_revision_at = Column(DateTime(timezone=True), nullable=True)  # spaced repetition
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="concept_masteries")
    concept = relationship("Concept", back_populates="masteries")


# ─── QUIZZES ─────────────────────────────────────────────────────────────────

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String(500), nullable=False)
    subject = Column(String(200), nullable=True)
    topics = Column(JSON, default=list)
    difficulty = Column(SAEnum(DifficultyLevel), default=DifficultyLevel.MEDIUM)
    quiz_type = Column(SAEnum(QuizType), default=QuizType.MCQ)
    total_questions = Column(Integer, default=10)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id = Column(String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(SAEnum(QuizType), default=QuizType.MCQ)
    options = Column(JSON, nullable=True)           # list of option strings for MCQ
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    topic = Column(String(200), nullable=True)
    difficulty = Column(SAEnum(DifficultyLevel), default=DifficultyLevel.MEDIUM)
    source_chunk_id = Column(String(36), ForeignKey("material_chunks.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    quiz_id = Column(String(36), ForeignKey("quizzes.id", ondelete="CASCADE"))
    score = Column(Float, nullable=True)            # percentage score
    total_questions = Column(Integer, nullable=False)
    correct_count = Column(Integer, default=0)
    wrong_count = Column(Integer, default=0)
    time_taken_seconds = Column(Integer, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")
    answers = relationship("QuizAnswer", back_populates="attempt", cascade="all, delete-orphan")


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), index=True)
    question_id = Column(String(36), ForeignKey("quiz_questions.id"))
    user_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    time_taken_seconds = Column(Integer, nullable=True)

    attempt = relationship("QuizAttempt", back_populates="answers")


# ─── STUDY PLAN ───────────────────────────────────────────────────────────────

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String(500), nullable=False)
    exam_date = Column(DateTime(timezone=True), nullable=True)
    subject = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="study_plans")
    tasks = relationship("StudyTask", back_populates="plan", cascade="all, delete-orphan")


class StudyTask(Base):
    __tablename__ = "study_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_id = Column(String(36), ForeignKey("study_plans.id", ondelete="CASCADE"), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day_number = Column(Integer, nullable=False)
    scheduled_date = Column(DateTime(timezone=True), nullable=True)
    topic = Column(String(300), nullable=False)
    activity = Column(String(300), nullable=True)       # e.g., "Read", "Practice", "Quiz"
    duration_minutes = Column(Integer, default=30)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    priority = Column(Integer, default=1)               # 1=high, 2=medium, 3=low
    reason = Column(Text, nullable=True)                # why this was recommended
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("StudyPlan", back_populates="tasks")


# ─── CHAT ─────────────────────────────────────────────────────────────────────

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String(500), nullable=True)
    subject = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String(20), nullable=False)     # "user" or "assistant"
    content = Column(Text, nullable=False)
    sources = Column(JSON, default=list)          # list of source citation objects
    explain_level = Column(String(50), nullable=True)  # beginner/btech/exam/interview
    tokens_used = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")


# ─── INTERVIEW ────────────────────────────────────────────────────────────────

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    topic = Column(String(200), nullable=False)       # Python, DBMS, ML, etc.
    mode = Column(String(50), default="technical")    # technical or project_viva
    project_description = Column(Text, nullable=True) # for viva mode
    total_questions = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    feedback_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="interview_sessions")
    questions = relationship("InterviewQuestion", back_populates="session", cascade="all, delete-orphan")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_text = Column(Text, nullable=False)
    user_answer = Column(Text, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    correctness_score = Column(Float, nullable=True)   # 0-100
    relevance_score = Column(Float, nullable=True)
    depth_score = Column(Float, nullable=True)
    completeness_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    clarity_score = Column(Float, nullable=True)       # Backwards compatibility
    overall_score = Column(Float, nullable=True)
    is_skipped = Column(Boolean, default=False)
    follow_up_question = Column(Text, nullable=True)
    question_order = Column(Integer, nullable=False)
    difficulty = Column(SAEnum(DifficultyLevel), default=DifficultyLevel.MEDIUM)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("InterviewSession", back_populates="questions")


# ─── SUBJECTS & UNITS ────────────────────────────────────────────────────────

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    icon = Column(String(50), default="📚")
    color = Column(String(50), default="indigo")
    target_exam_date = Column(DateTime(timezone=True), nullable=True)
    progress_percent = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="subjects")
    units = relationship("Unit", back_populates="subject", cascade="all, delete-orphan", order_by="Unit.unit_number")
    resources = relationship("Resource", back_populates="subject", cascade="all, delete-orphan")


class Unit(Base):
    __tablename__ = "units"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    unit_number = Column(Integer, nullable=False, default=1)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    progress_percent = Column(Float, default=0.0)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    subject = relationship("Subject", back_populates="units")
    resources = relationship("Resource", back_populates="unit", cascade="all, delete-orphan")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    unit_id = Column(String(36), ForeignKey("units.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(500), nullable=False)
    resource_type = Column(String(50), nullable=False)  # image, video, lecture, youtube, pdf, document, notes, external_link
    description = Column(Text, nullable=True)
    url = Column(String(2000), nullable=True)
    thumbnail_url = Column(String(1000), nullable=True)
    file_path = Column(String(1000), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    file_type = Column(String(100), nullable=True)
    tags = Column(JSON, default=list)
    owner_name = Column(String(200), nullable=True)
    processing_status = Column(String(50), default="ready")  # uploading, processing, extracting, ready, failed
    processing_error = Column(Text, nullable=True)
    material_id = Column(String(36), ForeignKey("materials.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="resources")
    subject = relationship("Subject", back_populates="resources")
    unit = relationship("Unit", back_populates="resources")


# ─── NOTES ────────────────────────────────────────────────────────────────────

class Note(Base):
    __tablename__ = "notes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    unit_id = Column(String(36), ForeignKey("units.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="notes")


# ─── EXAMS ────────────────────────────────────────────────────────────────────

class Exam(Base):
    __tablename__ = "exams"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    subject_name = Column(String(200), nullable=False)
    exam_date = Column(DateTime(timezone=True), nullable=False)
    exam_time = Column(String(100), nullable=True)
    recommended_topics = Column(JSON, default=list)
    reminder_2day_sent = Column(Boolean, default=False)
    reminder_1day_sent = Column(Boolean, default=False)
    reminder_examday_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="exams")


# ─── STUDY SESSIONS & REMINDERS ───────────────────────────────────────────────

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    subject_name = Column(String(200), nullable=False)
    unit_name = Column(String(200), nullable=True)
    session_date = Column(DateTime(timezone=True), nullable=False)
    start_time = Column(String(50), nullable=False)  # e.g. "07:00 PM"
    end_time = Column(String(50), nullable=False)    # e.g. "09:00 PM"
    reminder_lead_minutes = Column(Integer, default=15)
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="study_sessions")


# ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(50), default="study")  # security, study, exam, ai, vault
    is_read = Column(Boolean, default=False)
    link = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")


# ─── USER NOTIFICATION SETTINGS ───────────────────────────────────────────────

class UserNotificationSettings(Base):
    __tablename__ = "user_notification_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    email_notifications = Column(Boolean, default=True)
    login_alerts = Column(Boolean, default=True)
    study_reminders = Column(Boolean, default=True)
    exam_reminders = Column(Boolean, default=True)
    study_plan_reminders = Column(Boolean, default=True)
    in_app_notifications = Column(Boolean, default=True)
    reminder_minutes_before = Column(Integer, default=15)
    exam_reminder_2days = Column(Boolean, default=True)
    exam_reminder_1day = Column(Boolean, default=True)
    exam_reminder_day_of = Column(Boolean, default=True)
    timezone = Column(String(100), default="Asia/Kolkata")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="notification_settings")
