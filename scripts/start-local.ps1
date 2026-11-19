[CmdletBinding()]
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pgRoot = Join-Path $env:LOCALAPPDATA "ElAt\postgresql-17"
$dataDir = Join-Path $env:LOCALAPPDATA "ElAt\postgres-data"
$logDir = Join-Path $env:LOCALAPPDATA "ElAt\logs"
$pgCtl = Join-Path $pgRoot "bin\pg_ctl.exe"
$pgIsReady = Join-Path $pgRoot "bin\pg_isready.exe"
$next = Join-Path $projectRoot "node_modules\next\dist\bin\next"
$node = (Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue |
  Select-Object -First 1).Source

if (-not $node) {
  $node = Get-AppxPackage -Name "OpenAI.CodexPrimaryRuntime*" |
    Sort-Object Version -Descending |
    ForEach-Object { Join-Path $_.InstallLocation "dependencies\node\bin\node.exe" } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
}
if (-not $node) { throw "Node.js kurulumunu bulamadim." }

foreach ($requiredPath in @($pgCtl, $pgIsReady, $dataDir, $next)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Gerekli dosya bulunamadi: $requiredPath"
  }
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

& $pgIsReady -h 127.0.0.1 -p 5432 *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $dataDir -l (Join-Path $logDir "postgres.log") -o "-h 127.0.0.1 -p 5432" start
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL baslatilamadi." }
} else {
  & $pgCtl -D $dataDir status *> $null
  if ($LASTEXITCODE -ne 0) { throw "5432 portunda baska bir PostgreSQL sunucusu var." }
}

$server = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $server) {
  Start-Process -FilePath $node `
    -ArgumentList @("node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "next-dev.stdout.log") `
    -RedirectStandardError (Join-Path $logDir "next-dev.stderr.log")
}

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    if ($health.status -eq "ok") {
      $response = Invoke-WebRequest -Uri "http://localhost:3000/giris" -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200 -and $response.Content.Contains("El At!")) {
        $ready = $true
        break
      }
    }
  } catch { }
  Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw "El At! hazir degil. 3000 portunu ve loglari kontrol et: $logDir" }

if (-not $NoBrowser) { Start-Process "http://localhost:3000/giris" }
