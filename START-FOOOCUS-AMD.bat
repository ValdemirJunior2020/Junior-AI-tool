@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo Missing local .env configuration. Run SETUP-JUNIOR-AI.bat.
  pause
  exit /b 1
)
call npm run fooocus:start
pause
