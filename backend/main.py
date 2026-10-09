"""
StudyOS AI — Backend Root Entry Point for Vercel
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

handler = app

__all__ = ["app", "handler"]
