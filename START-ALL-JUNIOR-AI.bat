@echo off
setlocal
title Junior AI - All-in-One Launcher
cd /d "%~dp0"
if not exist ".env" (
  echo ERROR: Missing .env. Run SETUP-JUNIOR-AI.bat first.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo ERROR: Missing node_modules. Run SETUP-JUNIOR-AI.bat first.
  pause
  exit /b 1
)
echo ========================================
echo  JUNIOR AI - START EVERYTHING
echo ========================================
echo.
echo [1/4] Checking Ollama...
powershell -NoProfile -Command "exit (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 11434 -InformationLevel Quiet -WarningAction SilentlyContinue))" >nul 2>nul
if errorlevel 1 (
  where ollama >nul 2>nul
  if errorlevel 1 (
    echo WARNING: Ollama not found in PATH. Start the Ollama app manually.
  ) else (
    echo Starting Ollama...
    start "Junior AI - Ollama" cmd /k "ollama serve"
  )
) else (
  echo Ollama is already running.
)
echo.
echo [2/4] Checking Fooocus AMD...
if not exist "C:\AI\Fooocus_win64_2-5-0\python_embeded\python.exe" (
  echo WARNING: Fooocus portable Python not found in expected directory.
) else (
  echo Launching Fooocus supervisor in a separate window...
  echo It will start Fooocus when needed and restart it if the process exits.
  start "Junior AI - Fooocus AMD" /D "%~dp0" powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0scripts\watch-fooocus.ps1"
)
echo.
echo [3/4] Building Junior AI frontend...
call npm run build
if errorlevel 1 (
  echo ERROR: Build failed. Review messages above.
  pause
  exit /b 1
)
echo.
echo [4/4] Starting Junior AI...
set "ENABLE_FOOOCUS=true"
start "" "http://127.0.0.1:3001"
echo.
echo Keep this window open while using Junior AI.\necho Keep the Fooocus supervisor window open too; it will restart Fooocus if needed.
echo Fooocus may take several minutes to start and download models.
echo Image generation remains restricted to administrator accounts locally.
echo.
call npm start
echo Junior AI server stopped.
pause
