"""
StudyOS AI — Vercel Serverless Function Entry Point.
Routes API requests to the FastAPI application located in backend/app/main.py.
"""
import sys
from pathlib import Path

# Ensure backend directory is in sys.path so 'app' module imports resolve cleanly
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app, handler

__all__ = ["app", "handler"]
