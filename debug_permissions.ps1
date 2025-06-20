Write-Host "=== NeuroChat Permission Debug Script ===" -ForegroundColor Yellow
Write-Host ""

# Check if backend is running
Write-Host "1. Checking if backend server is running..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/categories" -Method Get -TimeoutSec 5
    Write-Host "   ✅ Backend server is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend server is NOT running" -ForegroundColor Red
    Write-Host "   Please start backend with: cd backend && npm start" -ForegroundColor Yellow
    exit 1
}

# Check if frontend is running
Write-Host "2. Checking if frontend server is running..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host "   ✅ Frontend server is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Frontend server is NOT running" -ForegroundColor Red
    Write-Host "   Please start frontend with: cd frontend && npm start" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== PERMISSION FIX STEPS ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "The permission system has been fixed. To resolve caching issues:" -ForegroundColor White
Write-Host ""
Write-Host "1. 🔄 CLEAR BROWSER CACHE:" -ForegroundColor Cyan
Write-Host "   - Press F12 to open DevTools" -ForegroundColor White
Write-Host "   - Right-click the refresh button" -ForegroundColor White
Write-Host "   - Select 'Empty Cache and Hard Reload'" -ForegroundColor White
Write-Host ""
Write-Host "2. 🗑️ CLEAR LOCALSTORAGE:" -ForegroundColor Cyan
Write-Host "   - In DevTools, go to Application/Storage tab" -ForegroundColor White
Write-Host "   - Find 'Local Storage' -> 'http://localhost:3000'" -ForegroundColor White
Write-Host "   - Delete 'auth_token' and 'user_data' entries" -ForegroundColor White
Write-Host ""
Write-Host "3. 🔐 LOG OUT AND LOG BACK IN:" -ForegroundColor Cyan
Write-Host "   - This will get fresh JWT tokens with correct permissions" -ForegroundColor White
Write-Host ""
Write-Host "4. 🧪 TEST WITH DIFFERENT USERS:" -ForegroundColor Cyan
Write-Host "   - admin@demo.com (password: demo123) - Should see ALL features" -ForegroundColor Green
Write-Host "   - tier2@demo.com (password: demo123) - Should NOT see User Mgmt/Audit/Insights" -ForegroundColor Red
Write-Host "   - agent@demo.com (password: demo123) - Should NOT see User Mgmt/Audit/Insights" -ForegroundColor Red
Write-Host ""
Write-Host "✅ Both servers are running. Please follow the steps above!" -ForegroundColor Green