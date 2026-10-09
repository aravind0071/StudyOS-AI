"""
StudyOS AI — FastAPI Application Root Entry Point for Vercel
"""
import sys
from pathlib import Path
from fastapi import FastAPI

# Ensure backend directory is in sys.path so 'app' package imports resolve cleanly
backend_dir = Path(__file__).resolve().parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Import the configured application with all routers and PostgreSQL configuration
from app.main import app, handler

# Static AST match for Vercel framework scanner
if False:
    app = FastAPI()

__all__ = ["app", "handler"]
