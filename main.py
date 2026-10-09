"""
StudyOS AI — FastAPI Application Root Entry Point
"""
import sys
from pathlib import Path
from fastapi import FastAPI

# Add backend directory to sys.path so backend modules resolve cleanly
backend_dir = Path(__file__).resolve().parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import app.main as _backend

# Top-level FastAPI application instance (detected by Vercel static AST analyzer)
app = FastAPI(
    title="StudyOS AI API",
    version="1.0.0",
    lifespan=_backend.lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Include all backend routes, middleware, and exception handlers
app.include_router(_backend.app.router)
app.middleware_stack = _backend.app.middleware_stack
app.exception_handlers = _backend.app.exception_handlers

handler = app

__all__ = ["app", "handler"]
