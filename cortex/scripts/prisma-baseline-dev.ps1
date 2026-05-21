param(
  [ValidateSet("all", "precheck", "reconcile", "baseline", "validate")]
  [string]$Step = "all",
  [string]$MigrationName = "",
  [string[]]$AllowedProjectRefs = @(),
  [switch]$AllowUnknownHost
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Import-DotEnv {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
      return
    }

    $eqIdx = $line.IndexOf("=")
    if ($eqIdx -lt 1) {
      return
    }

    $key = $line.Substring(0, $eqIdx).Trim()
    $value = $line.Substring($eqIdx + 1).Trim()

    if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
      $value = $value.Substring(1, $value.Length - 2)
    } elseif ($value.StartsWith("'") -and $value.EndsWith("'") -and $value.Length -ge 2) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($key, $value, "Process")
  }
}

function Get-UrlInfo {
  param([string]$ConnectionString)
  try {
    $uri = [Uri]$ConnectionString
  } catch {
    throw "No se pudo parsear URL de conexion."
  }

  $dbHost = $uri.Host.ToLowerInvariant()
  $projectRef = $null
  if ($dbHost -match "^db\.([a-z0-9]+)\.supabase\.co$") {
    $projectRef = $Matches[1]
  }

  [pscustomobject]@{
    Host       = $dbHost
    ProjectRef = $projectRef
    Raw        = $ConnectionString
  }
}

function Test-IsProdLikeHost {
  param([string]$HostName)
  $prodHints = @("prod", "production", "live", "primary")
  foreach ($hint in $prodHints) {
    if ($HostName -like "*$hint*") {
      return $true
    }
  }
  return $false
}

function Test-IsSafeHost {
  param([string]$HostName)
  $safeHints = @("localhost", "127.0.0.1", "0.0.0.0", "dev", "staging", "stage", "test", "sandbox")
  foreach ($hint in $safeHints) {
    if ($HostName -like "*$hint*") {
      return $true
    }
  }
  return $false
}

function Invoke-Prisma {
  param([string[]]$Arguments)
  Write-Host ("npx prisma " + ($Arguments -join " ")) -ForegroundColor DarkGray
  & npx prisma @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo comando Prisma: npx prisma $($Arguments -join ' ')"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot

$schemaPath = Join-Path $repoRoot "prisma\schema.prisma"
$migrationsRoot = Join-Path $repoRoot "prisma\migrations"
$migrationLockPath = Join-Path $migrationsRoot "migration_lock.toml"
$envPath = Join-Path $repoRoot ".env"
$schemaBackup = Join-Path $env:TEMP ("schema-before-db-pull-{0}.prisma" -f [guid]::NewGuid().ToString("N"))

if (-not (Test-Path -LiteralPath $schemaPath)) {
  throw "No existe prisma/schema.prisma en este repositorio."
}

Import-DotEnv -Path $envPath

if ($Step -in @("all", "precheck", "validate")) {
  Write-Step "Precheck de seguridad (dev/staging)"
  $databaseUrl = $env:DATABASE_URL
  $shadowUrl = $env:SHADOW_DATABASE_URL

  if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw "DATABASE_URL es obligatorio."
  }
  if ([string]::IsNullOrWhiteSpace($shadowUrl)) {
    throw "SHADOW_DATABASE_URL es obligatorio para validaciones de drift."
  }
  if ($databaseUrl -eq $shadowUrl) {
    throw "DATABASE_URL y SHADOW_DATABASE_URL no pueden ser iguales."
  }

  $dbInfo = Get-UrlInfo -ConnectionString $databaseUrl
  $shadowInfo = Get-UrlInfo -ConnectionString $shadowUrl

  if (Test-IsProdLikeHost -HostName $dbInfo.Host) {
    throw "Bloqueado: DATABASE_URL parece entorno de produccion ('$($dbInfo.Host)')."
  }
  if (Test-IsProdLikeHost -HostName $shadowInfo.Host) {
    throw "Bloqueado: SHADOW_DATABASE_URL parece entorno de produccion ('$($shadowInfo.Host)')."
  }

  $dbHostAllowed = (Test-IsSafeHost -HostName $dbInfo.Host)
  if (-not $dbHostAllowed -and $dbInfo.ProjectRef) {
    $dbHostAllowed = $AllowedProjectRefs -contains $dbInfo.ProjectRef
  }
  if (-not $dbHostAllowed -and -not $AllowUnknownHost) {
    throw "Bloqueado: host DATABASE_URL no tiene marca dev/staging. Usa -AllowedProjectRefs <ref> o -AllowUnknownHost."
  }

  $shadowHostAllowed = (Test-IsSafeHost -HostName $shadowInfo.Host)
  if (-not $shadowHostAllowed -and $shadowInfo.ProjectRef) {
    $shadowHostAllowed = $AllowedProjectRefs -contains $shadowInfo.ProjectRef
  }
  if (-not $shadowHostAllowed -and -not $AllowUnknownHost) {
    throw "Bloqueado: host SHADOW_DATABASE_URL no tiene marca dev/staging. Usa -AllowedProjectRefs <ref> o -AllowUnknownHost."
  }

  Write-Host "Precheck OK."
}

if ($Step -eq "precheck") {
  exit 0
}

if ($Step -in @("all", "reconcile")) {
  Write-Step "Reconciliacion schema <> DB (db pull)"
  Copy-Item -LiteralPath $schemaPath -Destination $schemaBackup -Force

  Invoke-Prisma -Arguments @("db", "pull", "--schema", "prisma/schema.prisma")
  Invoke-Prisma -Arguments @("format", "--schema", "prisma/schema.prisma")

  Write-Host "Resumen diff schema antes/despues:"
  & git --no-pager diff --no-index -- $schemaBackup $schemaPath
  if ($LASTEXITCODE -gt 1) {
    throw "No se pudo generar diff de reconciliacion."
  }
}

if ($Step -eq "reconcile") {
  exit 0
}

if ($Step -in @("all", "baseline")) {
  Write-Step "Creacion de baseline local"
  if (Test-Path -LiteralPath $migrationsRoot) {
    $existingDirs = Get-ChildItem -LiteralPath $migrationsRoot -Directory -ErrorAction SilentlyContinue
    if ($existingDirs -and $existingDirs.Count -gt 0) {
      throw "Ya existen migraciones en prisma/migrations. No se creara baseline automatico."
    }
  }

  if ([string]::IsNullOrWhiteSpace($MigrationName)) {
    $MigrationName = "{0}_baseline" -f (Get-Date -Format "yyyyMMddHHmmss")
  }
  if ($MigrationName -notmatch "^[a-zA-Z0-9_-]+$") {
    throw "MigrationName invalido. Usa solo letras, numeros, guion y guion bajo."
  }

  $migrationDir = Join-Path $migrationsRoot $MigrationName
  New-Item -ItemType Directory -Path $migrationDir -Force | Out-Null
  if (-not (Test-Path -LiteralPath $migrationLockPath)) {
    Set-Content -LiteralPath $migrationLockPath -Encoding UTF8 -Value @(
      "# Please do not edit this file manually"
      "# It should be added in your version-control system (e.g., Git)"
      "provider = ""postgresql"""
    )
  }
  $migrationSqlPath = Join-Path $migrationDir "migration.sql"

  $migrationSql = & npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo generar migration.sql para baseline."
  }
  Set-Content -LiteralPath $migrationSqlPath -Value $migrationSql -Encoding UTF8

  Invoke-Prisma -Arguments @("migrate", "resolve", "--applied", $MigrationName, "--schema", "prisma/schema.prisma")
  Write-Host "Baseline generado en prisma/migrations/$MigrationName/migration.sql"
}

if ($Step -eq "baseline") {
  exit 0
}

if ($Step -in @("all", "validate")) {
  Write-Step "Validaciones de consistencia"
  Invoke-Prisma -Arguments @("validate", "--schema", "prisma/schema.prisma")
  Invoke-Prisma -Arguments @("migrate", "status", "--schema", "prisma/schema.prisma")
  Invoke-Prisma -Arguments @(
    "migrate", "diff",
    "--from-migrations", "prisma/migrations",
    "--to-schema-datamodel", "prisma/schema.prisma",
    "--shadow-database-url", $env:SHADOW_DATABASE_URL
  )
  Write-Host "Validacion final OK."
}
