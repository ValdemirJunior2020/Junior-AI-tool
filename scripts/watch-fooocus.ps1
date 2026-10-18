# Keeps Fooocus AMD available while Junior AI is running.
# Launched automatically by START-ALL-JUNIOR-AI.bat; no extra software required.
Set-Location (Split-Path -Parent $PSScriptRoot)
$ErrorActionPreference = "Continue"
Write-Host ("Junior AI directory: " + (Get-Location).Path)
function Test-LocalPort([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(1000)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch { return $false }
  finally { $client.Dispose() }
}
Write-Host "Junior AI - Fooocus AMD Supervisor" -ForegroundColor Cyan
while ($true) {
  if (Test-LocalPort 7865) {
    Write-Host "Fooocus is already serving on port 7865. Checking again shortly..."
    Start-Sleep -Seconds 15
    continue
  }
  Write-Host "Starting Fooocus AMD at http://127.0.0.1:7865 ..." -ForegroundColor Green
  try {
    & npm.cmd run fooocus:start
    Write-Host ("Fooocus stopped (exit code " + $LASTEXITCODE + "). Restarting in 15 seconds...") -ForegroundColor Yellow
  } catch {
    Write-Host ("Fooocus start failed: " + $_.Exception.Message) -ForegroundColor Red
  }
  Start-Sleep -Seconds 15
}
