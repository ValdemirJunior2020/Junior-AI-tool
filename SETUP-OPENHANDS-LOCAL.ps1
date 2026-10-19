# OpenHands local CLI installer. Run from PowerShell on the Windows PC hosting Junior AI.
# Does not replace main BAT, .git, existing local user data, or secrets.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "=== Junior AI Software Builder: Local OpenHands Setup ===" -ForegroundColor Cyan
Write-Host "WARNING: WSL OpenHands CLI is NOT a complete OS security sandbox." -ForegroundColor Yellow
Write-Host "The agent may execute commands and access Windows drives mounted in WSL. Use trusted tasks only." -ForegroundColor Yellow
Write-Host "The Junior AI web interface restricts this to local super admins." -ForegroundColor Yellow
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  Write-Host "WSL is unavailable. First run: wsl --install -d Ubuntu (elevated PowerShell), then restart." -ForegroundColor Red
  exit 1
}
& wsl.exe --distribution Ubuntu --exec bash -lc 'printf "Ubuntu WSL is available\n"'
if ($LASTEXITCODE -ne 0) {
  Write-Host "Ubuntu WSL not installed or initialized. Run wsl --install -d Ubuntu and complete initial setup." -ForegroundColor Red
  exit 1
}
$setup = @'
set -euo pipefail
if ! command -v curl >/dev/null; then
  echo "Missing curl. Install in Ubuntu: sudo apt update && sudo apt install curl"
  exit 8
fi
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
if ! command -v uv >/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
uv python install 3.12
uv tool install --python 3.12 openhands
openhands --version
'@
Write-Host "Installing uv, Python 3.12 and the open-source OpenHands CLI inside Ubuntu WSL..."
# PowerShell multiline here-strings contain CRLF on Windows; Bash needs LF.
# Pass a single LF-normalized command argument, avoiding CR in 'set -euo pipefail'.
$setup = $setup -replace "`r`n", "`n" -replace "`r", ""
& wsl.exe --distribution Ubuntu --exec bash -lc $setup
if ($LASTEXITCODE -ne 0) {
  Write-Host "OpenHands setup failed; original Junior AI remains unchanged." -ForegroundColor Red
  exit 1
}
Write-Host "Checking WSL -> local Ollama connectivity..."
& wsl.exe --distribution Ubuntu --exec bash -lc 'curl -fsS --max-time 5 http://127.0.0.1:11434/v1/models >/dev/null'
if ($LASTEXITCODE -ne 0) {
  Write-Host "WARNING: Ollama is not reachable from Ubuntu at localhost:11434." -ForegroundColor Yellow
  Write-Host "Start Ollama. If needed, configure Windows WSL mirrored networking (where supported)." -ForegroundColor Yellow
  Write-Host "Do not expose Ollama to the public network. Builder remains disabled." -ForegroundColor Yellow
  exit 2
}
$envFile = Join-Path $root ".env"
if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Host "Missing Junior AI .env. Run SETUP-JUNIOR-AI.bat first." -ForegroundColor Red
  exit 1
}
# Keep unrelated .env keys and all secret values as-is.
$existing = [System.IO.File]::ReadAllText($envFile)
if ($existing -match '(?m)^\s*ENABLE_SOFTWARE_BUILDER\s*=') {
  $updated = [regex]::Replace($existing,'(?m)^\s*ENABLE_SOFTWARE_BUILDER\s*=.*$','ENABLE_SOFTWARE_BUILDER=true')
} else {
  $updated = $existing.TrimEnd([char]13,[char]10) + [Environment]::NewLine + 'ENABLE_SOFTWARE_BUILDER=true' + [Environment]::NewLine
}
if ($updated -notmatch '(?m)^\s*OPENHANDS_MODEL\s*=') { $updated += [Environment]::NewLine + 'OPENHANDS_MODEL=qwen2.5-coder:14b' + [Environment]::NewLine }
if ($updated -notmatch '(?m)^\s*OPENHANDS_OLLAMA_URL\s*=') { $updated += [Environment]::NewLine + 'OPENHANDS_OLLAMA_URL=http://127.0.0.1:11434/v1' + [Environment]::NewLine }
[System.IO.File]::WriteAllText($envFile,$updated,(New-Object System.Text.UTF8Encoding($false)))
Write-Host "OpenHands installed and Builder enabled inside the existing .env." -ForegroundColor Green
Write-Host "Restart the ORIGINAL START-ALL-JUNIOR-AI.bat, then open http://127.0.0.1:3001 as super admin." -ForegroundColor Green
