@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
 echo Missing .env. Run SETUP-JUNIOR-AI.bat first.
 pause
 exit /b 1
)
echo Installing AMD DirectML in the official Fooocus embedded Python.
echo Your system Python and Ollama will not be changed.
call npm run fooocus:setup
if errorlevel 1 echo Installation failed. Check the error above.
pause
