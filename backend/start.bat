@echo off
echo 🚀 Starting NeuroChat Server with Email Configuration...
echo.

REM Set environment variables for email system
set JWT_SECRET=neurochat_jwt_secret_2024
set PORT=3001

REM IMAP Configuration for incoming emails
set IMAP_HOST=outlook.office365.com
set IMAP_PORT=993
set IMAP_USER=rabreu@neurovirtual.com
set IMAP_PASSWORD=Lbsitw482151$

REM SMTP Configuration for outgoing emails
set SMTP_HOST=smtp.office365.com
set SMTP_PORT=587

echo ✅ Email system configured:
echo    📤 Outbound: %IMAP_USER% via SMTP
echo    📥 Inbound: %IMAP_USER% via IMAP
echo    🌐 Server: http://localhost:%PORT%
echo.

REM Start the server
node server.js 