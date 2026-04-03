$ErrorActionPreference = 'Stop'

function Log-Info {
  param([string]$Message)
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Log-Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Log-Error {
  param([string]$Message)
  Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-Command {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-EnvFile {
  param(
    [string]$Path,
    [string[]]$DefaultLines
  )

  if (Test-Path $Path) {
    return
  }

  $dir = Split-Path $Path -Parent
  if (-not (Test-Path $dir)) {
    throw "Directory not found: $dir"
  }

  Set-Content -Path $Path -Value ($DefaultLines -join [Environment]::NewLine) -Encoding ASCII
  Log-Info "Created env file: $Path"
}

function Ensure-NpmDependencies {
  param([string]$ProjectPath)

  $nodeModulesPath = Join-Path $ProjectPath 'node_modules'
  $lockPath = Join-Path $ProjectPath 'package-lock.json'

  if (Test-Path $nodeModulesPath) {
    Log-Info "Dependencies already present in $ProjectPath"
    return
  }

  Push-Location $ProjectPath
  try {
    if (Test-Path $lockPath) {
      Log-Info "Installing dependencies with npm ci in $ProjectPath"
      & npm ci
    } else {
      Log-Info "Installing dependencies with npm install in $ProjectPath"
      & npm install
    }

    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed in $ProjectPath"
    }
  } finally {
    Pop-Location
  }
}

function Test-PortInUse {
  param([int]$Port)
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return $null -ne $conn
}

function Get-ContainerExists {
  param([string]$Name)
  $id = Get-DockerOutput -CommandArgs @('container', 'inspect', $Name, '--format', '{{.Id}}')
  return -not [string]::IsNullOrWhiteSpace($id)
}

function Get-ContainerRunning {
  param([string]$Name)
  $running = Get-DockerOutput -CommandArgs @('container', 'inspect', $Name, '--format', '{{.State.Running}}')
  return ($running -eq 'true')
}

function Get-DockerOutput {
  param([string[]]$CommandArgs)

  try {
    $result = & docker @CommandArgs 2>$null
    if ($LASTEXITCODE -ne 0 -or $null -eq $result) {
      return ''
    }

    if ($result -is [array]) {
      return (($result -join "`n").Trim())
    }

    return ([string]$result).Trim()
  } catch {
    return ''
  }
}

function Wait-ForPostgres {
  param(
    [string]$ContainerName,
    [int]$TimeoutSeconds = 90
  )

  $elapsed = 0
  while ($elapsed -lt $TimeoutSeconds) {
    try {
      & docker exec $ContainerName pg_isready -U postgres -d invoice_tracker | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Log-Info "PostgreSQL is ready"
        return
      }
    } catch {
    }

    Start-Sleep -Seconds 2
    $elapsed += 2
  }

  throw "PostgreSQL did not become ready within $TimeoutSeconds seconds"
}

function Apply-SqlFile {
  param(
    [string]$ContainerName,
    [string]$SqlPath
  )

  if (-not (Test-Path $SqlPath)) {
    throw "Missing SQL file: $SqlPath"
  }

  Log-Info "Applying SQL file: $SqlPath"
  Get-Content $SqlPath | docker exec -i $ContainerName psql -U postgres -d invoice_tracker
  if ($LASTEXITCODE -ne 0) {
    throw "Failed applying SQL file: $SqlPath"
  }
}

try {
  if (-not (Test-Command 'docker')) {
    throw 'Docker CLI not found. Install Docker Desktop and retry.'
  }

  if (-not (Test-Command 'npm')) {
    throw 'npm not found. Install Node.js and retry.'
  }

  $dockerOk = $true
  try {
    & docker version | Out-Null
    & docker ps -q | Out-Null
    if ($LASTEXITCODE -ne 0) { $dockerOk = $false }
  } catch {
    $dockerOk = $false
  }

  if (-not $dockerOk) {
    throw 'Docker is not running. Start Docker Desktop and retry.'
  }

  $root = Split-Path -Parent $MyInvocation.MyCommand.Path
  $backendPath = Join-Path $root 'backend'
  $frontendPath = Join-Path $root 'frontend'
  $databasePath = Join-Path $root 'database'
  $migrationPath = Join-Path $databasePath 'migrations'
  $schemaPath = Join-Path $databasePath 'schema.sql'
  $seedPath = Join-Path $databasePath 'seed.sql'

  if (-not (Test-Path $backendPath)) { throw "Missing folder: $backendPath" }
  if (-not (Test-Path $frontendPath)) { throw "Missing folder: $frontendPath" }
  if (-not (Test-Path $databasePath)) { throw "Missing folder: $databasePath" }

  Ensure-EnvFile -Path (Join-Path $backendPath '.env') -DefaultLines @(
    'PORT=5000',
    'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/invoice_tracker',
    'CORS_ORIGIN=http://localhost:5173',
    'DEMO_USER_ID=11111111-1111-1111-1111-111111111111',
    'ALGORAND_ALGOD_SERVER=https://testnet-api.algonode.cloud',
    'ALGORAND_ALGOD_PORT=443',
    'ALGORAND_ALGOD_TOKEN=',
    'ALGORAND_ANCHOR_MNEMONIC=',
    'ALGORAND_ANCHOR_RECEIVER=',
    'ALGORAND_EXPLORER_BASE_URL=https://testnet.algoexplorer.io/tx/',
    'BUSINESS_NAME=Your Business Name',
    'BUSINESS_ADDRESS=123 Street Address',
    'BUSINESS_CITY_STATE=Mumbai, MH 400001',
    'BUSINESS_PHONE=(000) 000-0000',
    'BUSINESS_EMAIL=contact@yourbusiness.com',
    'OVERDUE_JOB_INTERVAL_MS=60000'
  )

  Ensure-EnvFile -Path (Join-Path $frontendPath '.env') -DefaultLines @(
    'VITE_API_URL=http://localhost:5000/api',
    'VITE_DEMO_USER_ID=11111111-1111-1111-1111-111111111111'
  )

  $containerName = 'invoice-postgres'
  Log-Info 'Starting DB'
  if (Get-ContainerExists -Name $containerName) {
    if (-not (Get-ContainerRunning -Name $containerName)) {
      & docker start $containerName | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to start container: $containerName"
      }
    } else {
      Log-Info 'PostgreSQL container already running'
    }
  } else {
    & docker run -d --name $containerName -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=invoice_tracker -p 5432:5432 postgres:16 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create container: $containerName"
    }
  }

  Wait-ForPostgres -ContainerName $containerName

  Log-Info 'Applying schema and seed'
  try {
    Apply-SqlFile -ContainerName $containerName -SqlPath $schemaPath
    Apply-SqlFile -ContainerName $containerName -SqlPath $seedPath
    if (Test-Path $migrationPath) {
      $migrationFiles = Get-ChildItem -Path $migrationPath -Filter '*.sql' | Sort-Object Name
      foreach ($migration in $migrationFiles) {
        Apply-SqlFile -ContainerName $containerName -SqlPath $migration.FullName
      }
    }
  } catch {
    Log-Error $_.Exception.Message
    throw 'Database setup failed'
  }

  if (Test-PortInUse -Port 5000) {
    Log-Warn 'Port 5000 is already in use. Backend may already be running.'
  }

  if (Test-PortInUse -Port 5173) {
    Log-Warn 'Port 5173 is already in use. Frontend may already be running.'
  }

  Log-Info 'Installing backend dependencies'
  Ensure-NpmDependencies -ProjectPath $backendPath

  Log-Info 'Installing frontend dependencies'
  Ensure-NpmDependencies -ProjectPath $frontendPath

  Log-Info 'Starting Backend'
  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    "Set-Location '$backendPath'; node src/server.js"
  ) | Out-Null

  Start-Sleep -Seconds 2

  Log-Info 'Starting Frontend'
  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    "Set-Location '$frontendPath'; npm run dev"
  ) | Out-Null

  Start-Sleep -Seconds 2

  Write-Host ''
  Write-Host 'Backend:  http://localhost:5000' -ForegroundColor Green
  Write-Host 'Frontend: http://localhost:5173' -ForegroundColor Green
  Write-Host ''
  Log-Info 'Development stack is up'
}
catch {
  Log-Error $_.Exception.Message
  exit 1
}
