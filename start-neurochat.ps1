# NeuroChat Complete Application Startup Script
Write-Host "🧠 NeuroChat Support System - Complete Startup" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""

# Start NeuroChat Application
Write-Host "Starting NeuroChat Application..." -ForegroundColor Green

# Kill any existing node processes
Write-Host "Stopping any existing Node.js processes..." -ForegroundColor Yellow
try {
    taskkill /F /IM node.exe 2>$null
    Start-Sleep 2
} catch {
    # Ignore if no processes to kill
}

# Start backend
Write-Host "Starting backend server..." -ForegroundColor Cyan
cd backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server.js" -WorkingDirectory (Get-Location)

# Wait for backend to start
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep 5

# Test backend connectivity
Write-Host "Testing backend connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 10
    Write-Host "✅ Backend is running on port 3001" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend failed to start or is not accessible" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Change to frontend directory
cd ../frontend

# Start frontend
Write-Host "Starting frontend development server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WorkingDirectory (Get-Location)

Write-Host "" 
Write-Host "🚀 NeuroChat Application Started!" -ForegroundColor Green
Write-Host "📱 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test fuzzy matching, run: .\test_fuzzy_matching.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host