@echo off
echo Starting Think Compass...

REM 启动后端
start "Backend Server" cmd /k "cd backend && .\.venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

REM 等待3秒让后端启动
echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

REM 启动前端
start "Frontend Dev Server" cmd /k "cd frontend && npm run dev -- --host 0.0.0.0 --port 5173"

echo.
echo Services starting...
echo Backend: http://localhost:8001
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this window...
pause > nul