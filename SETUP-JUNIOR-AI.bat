@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo ERROR: Install Node.js 22 or newer first.
 pause
 exit /b 1
)
if not exist ".env" (
 copy ".env.example" ".env" >nul
 echo Created .env for your local configuration.
)
call npm install
if errorlevel 1 (
 echo ERROR: npm install failed. Existing files remain unchanged.
 pause
 exit /b 1
)
echo Run: npm run admin
echo Then double-click START-JUNIOR-AI.bat
pause
