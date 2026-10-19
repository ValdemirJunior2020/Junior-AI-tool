# Called by the existing START-ALL-JUNIOR-AI.bat. Local Ollama only.
# Creates a dedicated context-configured alias; does not change other Ollama models.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envPath)) { exit 0 }
$config = [System.IO.File]::ReadAllText($envPath)
if ($config -notmatch '(?m)^\s*ENABLE_SOFTWARE_BUILDER\s*=\s*true\s*$') { exit 0 }

$api = 'http://127.0.0.1:11434'
$alias = 'junior-ai-builder-qwen35:latest'
try {
  $tags = Invoke-RestMethod -Uri ($api + '/api/tags') -TimeoutSec 8
  $names = @($tags.models | ForEach-Object { $_.name })
  if ($names -notcontains $alias) {
    if ($names -notcontains 'qwen3.5:9b') {
      Write-Host '[Builder] qwen3.5:9b not found. Keeping current model configuration.' -ForegroundColor Yellow
      exit 0
    }
    Write-Host '[Builder] Configuring dedicated Qwen 3.5 context (32768 tokens)...'
    $payload = @{
      model = $alias
      from = 'qwen3.5:9b'
      parameters = @{ num_ctx = 32768; temperature = 0.2 }
      stream = $false
    } | ConvertTo-Json -Depth 5
    $result = Invoke-RestMethod -Method Post -Uri ($api + '/api/create') -Body $payload -ContentType 'application/json' -TimeoutSec 180
    if ($result.status -ne 'success') { throw 'Ollama did not confirm alias creation.' }
  }
  # Do not overwrite a deliberately selected custom model.
  $match = [regex]::Match($config, '(?m)^\s*OPENHANDS_MODEL\s*=\s*([^\r\n#]+)')
  $current = if ($match.Success) { $match.Groups[1].Value.Trim() } else { '' }
  if ($current -in @('', 'qwen3.5:9b', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b', $alias)) {
    if ($config -match '(?m)^\s*OPENHANDS_MODEL\s*=') {
      $config = [regex]::Replace($config, '(?m)^\s*OPENHANDS_MODEL\s*=.*$', ('OPENHANDS_MODEL=' + $alias))
    } else {
      $config = $config.TrimEnd([char]13,[char]10) + [Environment]::NewLine + 'OPENHANDS_MODEL=' + $alias + [Environment]::NewLine
    }
    [System.IO.File]::WriteAllText($envPath, $config, (New-Object System.Text.UTF8Encoding($false)))
  }
  Write-Host '[Builder] Local coding model ready with 32K context.' -ForegroundColor Green
} catch {
  Write-Host ('[Builder] Context setup warning: ' + $_.Exception.Message) -ForegroundColor Yellow
  Write-Host '[Builder] Junior AI will continue starting. Software Builder may need attention.' -ForegroundColor Yellow
}
