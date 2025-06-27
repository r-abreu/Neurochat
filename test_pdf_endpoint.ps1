# Test PDF Report Endpoint
Write-Host "Testing PDF Report Generation Endpoint" -ForegroundColor Green

# First, let's test if we can reach the service workflow endpoints
$workflowId = "bc724f08-6960-4e26-92d6-746887247402"
$baseUrl = "http://localhost:3001"

# Test 1: Check basic API health
Write-Host "`n1. Testing API health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/categories" -Method GET
    Write-Host "   API is responding" -ForegroundColor Green
} catch {
    Write-Host "   API is not responding: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Try to access the PDF report endpoint (should get 401 auth error)
Write-Host "`n2. Testing PDF report endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/service-workflows/$workflowId/generate-pdf-report" -Method POST -Body '{"reportType":"draft"}' -ContentType "application/json"
    Write-Host "   Unexpected success: $response" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody = $_.Exception.Response | ConvertFrom-Json -ErrorAction SilentlyContinue
    
    if ($statusCode -eq 401) {
        Write-Host "   ✅ Endpoint exists (401 auth error as expected)" -ForegroundColor Green
    } elseif ($statusCode -eq 404) {
        Write-Host "   ❌ Endpoint not found (404 error)" -ForegroundColor Red
        Write-Host "   This means the PDF report endpoint is not registered" -ForegroundColor Yellow
    } else {
        Write-Host "   ⚠️  Unexpected status code: $statusCode" -ForegroundColor Yellow
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Test 3: List available endpoints (if server has endpoint listing)
Write-Host "`n3. Checking server routes..." -ForegroundColor Yellow
try {
    # This might not work depending on the server configuration
    $routes = Invoke-RestMethod -Uri "$baseUrl/api/routes" -Method GET -ErrorAction SilentlyContinue
    Write-Host "   Found route listing" -ForegroundColor Green
} catch {
    Write-Host "   No route listing available" -ForegroundColor Yellow
}

Write-Host "`n✅ Test completed!" -ForegroundColor Green
Write-Host "If you see a 404 error above, the PDF endpoint is not properly registered." -ForegroundColor Yellow
Write-Host "Try restarting the backend server completely." -ForegroundColor Yellow 