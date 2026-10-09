"""
StudyOS AI — Backend Entry Point
"""
import sys
from pathlib import Path
from fastapi import FastAPI

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import app.main as _backend

app = FastAPI(
    title="StudyOS AI API",
    version="1.0.0",
    lifespan=_backend.lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(_backend.app.router)
app.middleware_stack = _backend.app.middleware_stack
app.exception_handlers = _backend.app.exception_handlers

handler = app

__all__ = ["app", "handler"]
