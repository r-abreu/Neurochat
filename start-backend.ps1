Write-Host "Starting NeuroChat Backend Server..." -ForegroundColor Yellow
cd backend
$env:JWT_SECRET = "neurochat_jwt_secret_2024"
$env:PORT = "3001"
$env:IMAP_HOST = "outlook.office365.com"
$env:IMAP_PORT = "993"
$env:IMAP_USER = "rabreu@neurovirtual.com"
$env:IMAP_PASSWORD = "Lbsitw482151$"
$env:SMTP_HOST = "smtp.office365.com"
$env:SMTP_PORT = "587"
Write-Host "Backend server starting on http://localhost:3001" -ForegroundColor Green
node server.js 