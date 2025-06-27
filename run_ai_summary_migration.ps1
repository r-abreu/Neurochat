#!/usr/bin/env pwsh
# PowerShell script to run AI Summary database migration
# This ensures the database has the proper fields for AI summaries

Write-Host "🔧 Running AI Summary Database Migration" -ForegroundColor Cyan
Write-Host "=====================================`n" -ForegroundColor Cyan

# Check if migration file exists
$migrationFile = "database/migration_ensure_ai_summary_fields.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Found migration file: $migrationFile" -ForegroundColor Green

# Ask user for connection details
Write-Host "`n🔗 Database Connection Required" -ForegroundColor Yellow
Write-Host "Please provide your Azure SQL Database connection details:" -ForegroundColor White

$server = Read-Host "Server name (e.g., your-server.database.windows.net)"
$database = Read-Host "Database name (default: NeuroChat)" 
if ([string]::IsNullOrWhiteSpace($database)) {
    $database = "NeuroChat"
}

$username = Read-Host "Username"
$password = Read-Host "Password" -AsSecureString
$passwordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

# Build connection string
$connectionString = "Server=tcp:$server,1433;Initial Catalog=$database;Persist Security Info=False;User ID=$username;Password=$passwordText;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

Write-Host "`n🚀 Running migration..." -ForegroundColor Yellow

try {
    # Check if sqlcmd is available
    $sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue
    
    if ($sqlcmdPath) {
        Write-Host "Using sqlcmd..." -ForegroundColor Green
        $result = sqlcmd -S $server -d $database -U $username -P $passwordText -i $migrationFile
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ sqlcmd not found. Please install SQL Server Command Line Utilities." -ForegroundColor Red
        Write-Host "Alternative: Run the migration manually using SQL Server Management Studio" -ForegroundColor Yellow
        Write-Host "File location: $migrationFile" -ForegroundColor White
        exit 1
    }
    
    Write-Host "`n✅ Migration completed successfully!" -ForegroundColor Green
    Write-Host "The database now has proper AI summary fields configured." -ForegroundColor White
    
} catch {
    Write-Host "`n❌ Migration failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please check your connection details and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Restart your backend server" -ForegroundColor White
Write-Host "2. Test AI summary generation in the application" -ForegroundColor White
Write-Host "3. Check that summaries persist after page refresh" -ForegroundColor White 