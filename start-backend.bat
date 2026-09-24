@echo off
echo Starting StudyOS AI Backend Server...
cd /d "%~dp0backend"
call .\venv\Scripts\activate.bat
python -m uvicorn app.main:app --reload --port 8000
pause
