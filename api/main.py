"""
StudyOS AI — FastAPI API Entry Point for Vercel
"""
import sys
from pathlib import Path
from fastapi import FastAPI

backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app as _app

app: FastAPI = _app
handler = app

__all__ = ["app", "handler"]
