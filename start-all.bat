@echo off
echo ========================================================
echo          Starting StudyOS AI (Frontend + Backend)
echo ========================================================
echo.

start "StudyOS AI Backend (Port 8000)" cmd /k "cd /d %~dp0backend && .\venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --port 8000"

start "StudyOS AI Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Servers are launching in separate windows!
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000/docs
echo.
pause
