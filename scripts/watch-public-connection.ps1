# Keeps the public Junior AI connection available without exposing Fooocus or Ollama ports.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$exe = (Get-Command tailscale.exe -ErrorAction SilentlyContinue).Source
if (-not $exe) {
  $fallback = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
  if (Test-Path $fallback) { $exe = $fallback }
}
if (-not $exe) {
  Write-Host "Tailscale was not found. Public access cannot be started." -ForegroundColor Red
  exit 1
}
Write-Host "Junior AI - Public Connection" -ForegroundColor Cyan
while ($true) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/health" -TimeoutSec 4
    if ($health.ok -ne $true) { throw "Junior AI is not ready" }
    # --bg preserves the same configured Funnel across launcher restarts.
    & $exe funnel --bg 3001 | Out-Host
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Public connection is configured. Checking again in 5 minutes." -ForegroundColor Green
      Start-Sleep -Seconds 300
    } else {
      Write-Host "Could not establish the public connection. Checking again in 30 seconds." -ForegroundColor Yellow
      Start-Sleep -Seconds 30
    }
  } catch {
    Write-Host "Waiting for Junior AI to become available locally..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
  }
}
