# ====================================================================
# Meeting Whiteboard Assistant - One-Click Startup Script
# ====================================================================
#
# Usage:
# 1. Right-click this script and select "Run with PowerShell"
# 2. Or run in PowerShell: .\start-app.ps1
# 3. Press Ctrl+C to stop all services
#
# Prerequisites:
# - Node.js must be installed
# - Run 'npm install' in both InspireHub and server folders
#
# ====================================================================

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host $message -ForegroundColor Cyan
}

function Write-OK($message) {
    Write-Host $message -ForegroundColor Green
}

function Write-Error($message) {
    Write-Host $message -ForegroundColor Red
}

function Write-Warn($message) {
    Write-Host $message -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================================================"
Write-Step "          Meeting Whiteboard Assistant - Starting..."
Write-Host "========================================================================`n"

$ProjectRoot = $PSScriptRoot
$FrontendPath = Join-Path $ProjectRoot "InspireHub"
$BackendPath = Join-Path $ProjectRoot "server"
$FrontendPort = 5173
$BackendPort = 3001
$FrontendLog = Join-Path $ProjectRoot "frontend.log"
$BackendLog = Join-Path $ProjectRoot "backend.log"

$Global:FrontendProcess = $null
$Global:BackendProcess = $null

function Stop-AllServices {
    Write-Step "`nStopping all services..."

    if ($Global:BackendProcess -and !$Global:BackendProcess.HasExited) {
        Stop-Process -Id $Global:BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }

    if ($Global:FrontendProcess -and !$Global:FrontendProcess.HasExited) {
        Stop-Process -Id $Global:FrontendProcess.Id -Force -ErrorAction SilentlyContinue
    }

    Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }

    Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }

    Write-OK "All services stopped"
}

try {
    # Step 1: Check Node.js
    Write-Step "[1/6] Checking environment..."
    try {
        $nodeVersion = node -v
        Write-OK "[OK] Node.js: $nodeVersion"
    } catch {
        Write-Error "[ERROR] Node.js not found. Please install Node.js first."
        exit 1
    }
    Write-Host ""

    # Step 2: Check ports
    Write-Step "[2/6] Checking port availability..."

    $frontendPortInUse = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue
    if ($frontendPortInUse) {
        Write-Warn "[!] Port $FrontendPort is in use, releasing..."
        $frontendPortInUse | ForEach-Object {
            $pid = $_.OwningProcess
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-OK "[OK] Released port $FrontendPort (PID: $pid)"
        }
        Start-Sleep -Seconds 2
    } else {
        Write-OK "[OK] Port $FrontendPort is available"
    }

    $backendPortInUse = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue
    if ($backendPortInUse) {
        Write-Warn "[!] Port $BackendPort is in use, releasing..."
        $backendPortInUse | ForEach-Object {
            $pid = $_.OwningProcess
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-OK "[OK] Released port $BackendPort (PID: $pid)"
        }
        Start-Sleep -Seconds 2
    } else {
        Write-OK "[OK] Port $BackendPort is available"
    }
    Write-Host ""

    # Step 3: Check dependencies
    Write-Step "[3/6] Checking project dependencies..."

    if (!(Test-Path (Join-Path $FrontendPath "node_modules"))) {
        Write-Warn "[!] Installing frontend dependencies..."
        Push-Location $FrontendPath
        npm install
        Pop-Location
        if ($LASTEXITCODE -ne 0) {
            Write-Error "[ERROR] Frontend dependency installation failed"
            exit 1
        }
    } else {
        Write-OK "[OK] Frontend dependencies installed"
    }

    if (!(Test-Path (Join-Path $BackendPath "node_modules"))) {
        Write-Warn "[!] Installing backend dependencies..."
        Push-Location $BackendPath
        npm install
        Pop-Location
        if ($LASTEXITCODE -ne 0) {
            Write-Error "[ERROR] Backend dependency installation failed"
            exit 1
        }
    } else {
        Write-OK "[OK] Backend dependencies installed"
    }
    Write-Host ""

    # Step 4: Start backend
    Write-Step "[4/6] Starting backend service..."
    Push-Location $BackendPath
    $Global:BackendProcess = Start-Process -FilePath "node" -ArgumentList "app.js" -PassThru -NoNewWindow -RedirectStandardOutput $BackendLog
    Pop-Location
    Write-OK "[OK] Backend starting on port $BackendPort (PID: $($Global:BackendProcess.Id))"
    Write-Host ""

    # Step 5: Start frontend
    Write-Step "[5/6] Starting frontend service..."
    Push-Location $FrontendPath
    $Global:FrontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm", "run", "dev", ">", "`"$FrontendLog`"", "2>&1" -PassThru -NoNewWindow
    Pop-Location
    Write-OK "[OK] Frontend starting on port $FrontendPort (PID: $($Global:FrontendProcess.Id))"
    Write-Host ""

    # Step 6: Wait for services
    Write-Step "[6/6] Waiting for services to start..."

    $backendReady = $false
    $backendWait = 0
    while (!$backendReady -and $backendWait -lt 30) {
        Start-Sleep -Seconds 1
        $backendWait++
        $connection = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue
        if ($connection) {
            $backendReady = $true
            Write-OK "[OK] Backend ready ($backendWait seconds)"
        }
    }

    if (!$backendReady) {
        Write-Error "[ERROR] Backend startup timeout"
        Get-Content $BackendLog -ErrorAction SilentlyContinue
        exit 1
    }

    $frontendReady = $false
    $frontendWait = 0
    while (!$frontendReady -and $frontendWait -lt 30) {
        Start-Sleep -Seconds 1
        $frontendWait++
        $connection = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue
        if ($connection) {
            $frontendReady = $true
            Write-OK "[OK] Frontend ready ($frontendWait seconds)"
        }
    }

    if (!$frontendReady) {
        Write-Error "[ERROR] Frontend startup timeout"
        Get-Content $FrontendLog -ErrorAction SilentlyContinue
        exit 1
    }

    # Success!
    Write-Host ""
    Write-Host "========================================================================"
    Write-OK "          Successfully Started!"
    Write-Host "========================================================================`n"
    Write-OK "[OK] Frontend: http://localhost:$FrontendPort"
    Write-OK "[OK] Backend:  http://localhost:$BackendPort"
    Write-Host ""
    Write-Step "[INFO] Opening browser..."
    Write-Step "[INFO] Press Ctrl+C to stop all services"
    Write-Host ""

    Start-Sleep -Seconds 2
    Start-Process "http://localhost:$FrontendPort"

    Write-Host "========================================================================"
    Write-Host "Services are running..."
    Write-Host "========================================================================`n"
    Write-Host "Log files:"
    Write-Host "  Frontend: $FrontendLog"
    Write-Host "  Backend:  $BackendLog"
    Write-Host ""
    Write-Step "Press Ctrl+C to stop services...`n"

    # Monitor processes
    while ($true) {
        Start-Sleep -Seconds 5

        if ($Global:BackendProcess.HasExited) {
            Write-Error "`n[ERROR] Backend service exited unexpectedly"
            Get-Content $BackendLog -Tail 20 -ErrorAction SilentlyContinue
            break
        }

        if ($Global:FrontendProcess.HasExited) {
            Write-Error "`n[ERROR] Frontend service exited unexpectedly"
            Get-Content $FrontendLog -Tail 20 -ErrorAction SilentlyContinue
            break
        }
    }

} catch {
    Write-Error "`n[ERROR] $($_.Exception.Message)"
} finally {
    Stop-AllServices
    Write-Host "`nPress any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
