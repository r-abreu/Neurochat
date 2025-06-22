# NeuroChat Complete Application Startup Script
Write-Host "🧠 NeuroChat Support System - Complete Startup" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""

# Function to start backend
function Start-Backend {
    Write-Host "🚀 Starting Backend Server..." -ForegroundColor Yellow
    
    # Navigate to backend directory
    Push-Location "backend"
    
    # Set environment variables for email system
    $env:JWT_SECRET = "neurochat_jwt_secret_2024"
    $env:PORT = "3001"
    
    # IMAP Configuration for incoming emails
    $env:IMAP_HOST = "outlook.office365.com"
    $env:IMAP_PORT = "993"
    $env:IMAP_USER = "rabreu@neurovirtual.com"
    $env:IMAP_PASSWORD = "Lbsitw482151$"
    
    # SMTP Configuration for outgoing emails
    $env:SMTP_HOST = "smtp.office365.com"
    $env:SMTP_PORT = "587"
    
    Write-Host "✅ Email system configured:" -ForegroundColor Green
    Write-Host "   📤 Outbound: rabreu@neurovirtual.com via SMTP" -ForegroundColor Magenta
    Write-Host "   📥 Inbound: rabreu@neurovirtual.com via IMAP" -ForegroundColor Magenta
    Write-Host "   🌐 Backend API: http://localhost:3001" -ForegroundColor Magenta
    Write-Host ""
    
    # Start backend server in background
    Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "node server.js" -WindowStyle Normal
    
    Pop-Location
    Start-Sleep -Seconds 3
}

# Function to start frontend
function Start-Frontend {
    Write-Host "🎨 Starting Frontend Application..." -ForegroundColor Yellow
    
    # Navigate to frontend directory
    Push-Location "frontend"
    
    Write-Host "   🌐 Frontend App: http://localhost:3000" -ForegroundColor Magenta
    Write-Host ""
    
    # Start frontend in background
    Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Normal
    
    Pop-Location
    Start-Sleep -Seconds 2
}

# Main execution
try {
    Start-Backend
    Start-Frontend
    
    Write-Host "🎉 NeuroChat Application Started Successfully!" -ForegroundColor Green
    Write-Host ("=" * 60) -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Access Points:" -ForegroundColor Cyan
    Write-Host "   🌐 Main App:    http://localhost:3000" -ForegroundColor White
    Write-Host "   🔧 Backend API: http://localhost:3001" -ForegroundColor White
    Write-Host ""
    Write-Host "👤 Demo Accounts:" -ForegroundColor Cyan
    Write-Host "   Customer: customer@demo.com / demo123" -ForegroundColor White
    Write-Host "   Agent:    agent@demo.com / demo123" -ForegroundColor White
    Write-Host "   Admin:    admin@demo.com / demo123" -ForegroundColor White
    Write-Host ""
    Write-Host "📧 Email System:" -ForegroundColor Cyan
    Write-Host "   ✅ Outbound emails configured (SMTP)" -ForegroundColor White
    Write-Host "   ✅ Inbound emails configured (IMAP)" -ForegroundColor White
    Write-Host "   ✅ Auto ticket reopening enabled" -ForegroundColor White
    Write-Host "   ✅ Complete audit trail active" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
} catch {
    Write-Host "❌ Error starting application: $($_.Exception.Message)" -ForegroundColor Red
}