# AI Diagnostic Script
Write-Host "AI First Responder Diagnostic Tool" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Step 1: Check environment variables
Write-Host "`n1. Checking environment variables..." -ForegroundColor Yellow
$envFile = ".\backend\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    $hasOpenAiKey = $envContent | Where-Object { $_ -like "OPENAI_API_KEY=*" }
    if ($hasOpenAiKey) {
        Write-Host "OpenAI API key found in .env file" -ForegroundColor Green
    } else {
        Write-Host "OpenAI API key NOT found in .env file" -ForegroundColor Red
    }
} else {
    Write-Host ".env file not found" -ForegroundColor Red
}

# Step 2: Kill existing processes and restart properly
Write-Host "`n2. Restarting backend with proper environment..." -ForegroundColor Yellow
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped existing Node.js processes" -ForegroundColor Green
    Start-Sleep -Seconds 2
} catch {
    Write-Host "No existing processes to stop" -ForegroundColor Yellow
}

# Step 3: Start backend with dotenv
Write-Host "`n3. Starting backend with environment variables..." -ForegroundColor Yellow
Set-Location backend

# Check if dotenv is installed
$packageJson = Get-Content "package.json" | ConvertFrom-Json
if ($packageJson.dependencies.dotenv -or $packageJson.devDependencies.dotenv) {
    Write-Host "dotenv package is available" -ForegroundColor Green
} else {
    Write-Host "Installing dotenv package..." -ForegroundColor Yellow
    npm install dotenv
}

# Start the server
Write-Host "Starting server..." -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList "-r", "dotenv/config", "server.js" -NoNewWindow -PassThru
Set-Location ..

# Step 4: Wait and test
Write-Host "`n4. Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 5: Test AI functionality
Write-Host "`n5. Testing AI service..." -ForegroundColor Yellow
try {
    # Test health endpoint
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -ErrorAction Stop
    Write-Host "Backend is responding" -ForegroundColor Green
    
    # Login as admin to test AI config
    $loginData = @{
        email = "admin@demo.com"
        password = "demo123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $token = $loginResponse.data.tokens.accessToken

    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    # Test AI configuration
    $aiConfigResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/ai-agent/config" -Method GET -Headers $headers
    
    if ($aiConfigResponse.success) {
        $config = $aiConfigResponse.data.config
        Write-Host "`nAI Agent Configuration:" -ForegroundColor Green
        Write-Host "   - Enabled: $($config.enabled)" -ForegroundColor $(if ($config.enabled) { "Green" } else { "Red" })
        Write-Host "   - Agent Name: $($config.agent_name)" -ForegroundColor White
        Write-Host "   - Model: $($config.model)" -ForegroundColor White
        Write-Host "   - Confidence Threshold: $($config.confidence_threshold)" -ForegroundColor White
        
        if (-not $config.enabled) {
            Write-Host "`nAI Agent is DISABLED. Enabling it..." -ForegroundColor Yellow
            $enableData = @{
                enabled = $true
                agent_name = "NeuroAI"
                model = "gpt-4o"
                response_tone = "Technical"
                attitude_style = "Curious"
                context_limitations = "Only provide support for NeuroVirtual products and devices"
                exceptions_behavior = "warranty,refund,billing,escalate,human"
                confidence_threshold = 0.7
            } | ConvertTo-Json
            
            $updateResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/ai-agent/config" -Method PUT -Body $enableData -Headers $headers
            if ($updateResponse.success) {
                Write-Host "AI Agent has been enabled!" -ForegroundColor Green
            }
        }
    }
    
    # Test AI stats
    $aiStatsResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/ai-agent/stats" -Method GET -Headers $headers
    if ($aiStatsResponse.success) {
        $stats = $aiStatsResponse.data.stats
        Write-Host "`nAI Agent Statistics:" -ForegroundColor White
        Write-Host "   - Total Responses: $($stats.totalResponses)" -ForegroundColor White
        Write-Host "   - Documents Count: $($stats.documentsCount)" -ForegroundColor White
        Write-Host "   - Average Confidence: $([Math]::Round($stats.averageConfidence, 2))" -ForegroundColor White
    }
    
    Write-Host "`nAI SERVICE IS WORKING!" -ForegroundColor Green
    Write-Host "The AI should now respond as first responder to customer messages." -ForegroundColor Green
    
} catch {
    Write-Host "`nError testing AI service: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Backend may not be running properly." -ForegroundColor Red
}

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Open the customer chat interface" -ForegroundColor White
Write-Host "2. Send a message as a customer" -ForegroundColor White
Write-Host "3. The AI should respond automatically within a few seconds" -ForegroundColor White
Write-Host "4. If it doesn't work, check the backend console for error messages" -ForegroundColor White

Write-Host "`nDiagnostic completed!" -ForegroundColor Cyan 