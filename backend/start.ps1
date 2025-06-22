# NeuroChat Server Startup Script with Email Configuration
Write-Host "🚀 Starting NeuroChat Server with Email Configuration..." -ForegroundColor Cyan
Write-Host ""

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
Write-Host "   📤 Outbound: $($env:IMAP_USER) via SMTP" -ForegroundColor Yellow
Write-Host "   📥 Inbound: $($env:IMAP_USER) via IMAP" -ForegroundColor Yellow
Write-Host "   🌐 Server: http://localhost:$($env:PORT)" -ForegroundColor Yellow
Write-Host ""

# Start the server
Write-Host "🎯 Starting Node.js server..." -ForegroundColor Magenta
node server.js 