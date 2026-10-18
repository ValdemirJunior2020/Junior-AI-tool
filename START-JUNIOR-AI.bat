@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
 echo Run SETUP-JUNIOR-AI.bat first.
 pause
 exit /b 1
)
if not exist ".env" (
 echo Missing .env. Run SETUP-JUNIOR-AI.bat first.
 pause
 exit /b 1
)
call npm run build
if errorlevel 1 (
 echo Build failed. User data has not been deleted.
 pause
 exit /b 1
)
echo Junior AI starting on http://127.0.0.1:3001
call npm start
pause
