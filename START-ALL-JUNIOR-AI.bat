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
echo [2/4] Starting image engine supervisor...
if not exist "scripts\watch-fooocus.ps1" (
  echo ERROR: Image engine supervisor is missing. Run git pull origin main.
  pause
  exit /b 1
)
if not defined FOOOCUS_DIR set "FOOOCUS_DIR=C:\AI\Fooocus_win64_2-5-0"
if not exist "%FOOOCUS_DIR%\python_embeded\python.exe" (
  echo WARNING: Image engine files are not found at "%FOOOCUS_DIR%".
  echo Check FOOOCUS_DIR in the local .env configuration.
)
echo Launching image engine monitor...
start "Junior AI - Image Engine" /D "%~dp0" cmd.exe /k "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""%~dp0scripts\watch-fooocus.ps1"""
echo Startup logs appear in the Junior AI - Image Engine window.
echo.
echo [3/4] Building Junior AI frontend...
call npm run build
if errorlevel 1 (
  echo ERROR: Build failed. Review messages above.
  pause
  exit /b 1
)
echo.
echo [4/4] Starting Junior AI and public connection...
set "ENABLE_FOOOCUS=true"
if exist "scripts\watch-public-connection.ps1" (
  echo Launching secure public connection monitor...
  start "Junior AI - Public Connection" /D "%~dp0" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\watch-public-connection.ps1"
) else (
  echo WARNING: Public connection monitor was not found.
)
start "" "http://127.0.0.1:3001"
echo.
echo Keep this window and the image engine window open while using Junior AI.
echo Fooocus may take several minutes to start and download models.
echo Image creation permissions are controlled by Junior AI settings.
echo.
echo Junior AI server watchdog is active. If the backend stops unexpectedly, it will restart.
echo Press Ctrl+C in this window to stop Junior AI.
echo.
:restart_backend
call npm start
set "BACKEND_EXIT=%errorlevel%"
echo.
echo [WARNING] Junior AI backend exited with code %BACKEND_EXIT%.
echo Waiting 5 seconds before restarting. Keep this window open.
timeout /t 5 /nobreak >nul
goto restart_backend
