"""
StudyOS AI — FastAPI Main Application (Production & Serverless Ready)
"""

import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure backend root directory is always on sys.path regardless of execution entry point
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base, init_database_tables
from app.routers import (
    auth, materials, chat, quiz, study_plan,
    interview, analytics, search, profile,
    subjects, notifications, reminders,
    study_tools, notes
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Safely initialize database tables on startup and apply lightweight migrations."""
    logger.info("StudyOS AI starting up...")
    db_ok = init_database_tables()
    if not db_ok:
        logger.warning(
            "StudyOS AI started with database warnings. "
            "Inspect DATABASE_URL or database logs if queries fail."
        )
    yield
    logger.info("StudyOS AI shutting down.")


app = FastAPI(
    title="StudyOS AI API",
    description=(
        "StudyOS AI is a multimodal AI-powered personal learning platform that transforms "
        "scattered study materials into an intelligent, personalized learning environment."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ─── API PREFIX REWRITE MIDDLEWARE (ASGI) ────────────────────────────────────

class ApiPrefixMiddleware:
    """
    Pure ASGI middleware that transparently rewrites `/api/*` to `/*`.
    Ensures routes match whether called directly (/auth/login) or via
    Vercel serverless proxy (/api/auth/login) without buffering streaming responses.
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in ("http", "websocket"):
            path = scope.get("path", "")
            if path.startswith("/api/"):
                scope["path"] = path[4:]
            elif path == "/api":
                scope["path"] = "/"
        await self.app(scope, receive, send)


app.add_middleware(ApiPrefixMiddleware)


# ─── CORS ────────────────────────────────────────────────────────────────────

cors_origins = [settings.FRONTEND_URL, "http://localhost:3000"]
if "http://localhost:3000" not in cors_origins:
    cors_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── GLOBAL EXCEPTION HANDLERS ───────────────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return user-friendly validation errors."""
    errors = []
    for error in exc.errors():
        field = " → ".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({"field": field, "message": error["msg"]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors, "message": "Please check the form fields and try again."},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "Something went wrong on our end. Please try again in a moment."},
    )


# ─── ROUTERS ─────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(materials.router)
app.include_router(chat.router)
app.include_router(quiz.router)
app.include_router(study_plan.router)
app.include_router(interview.router)
app.include_router(analytics.router)
app.include_router(search.router)
app.include_router(profile.router)
app.include_router(subjects.router)
app.include_router(notifications.router)
app.include_router(reminders.router)
app.include_router(study_tools.router)
app.include_router(notes.router)


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health_check():
    safe_db_url = engine.url.render_as_string(hide_password=True)
    db_status = "connected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unreachable: {type(e).__name__}"

    is_healthy = db_status == "connected"
    return {
        "status": "healthy" if is_healthy else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": {
            "status": db_status,
            "dialect": engine.url.get_backend_name(),
            "url": safe_db_url,
        },
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "version": settings.APP_VERSION,
    }


# Vercel Serverless Function entrypoint alias
handler = app
