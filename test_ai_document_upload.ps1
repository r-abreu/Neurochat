# AI Document Upload Test for NeuroChat
Write-Host "📄 AI DOCUMENT UPLOAD TEST" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Step 1: Test backend connectivity
Write-Host "`n1. Testing backend connectivity..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running. Please start it first." -ForegroundColor Red
    exit 1
}

# Step 2: Login as admin
Write-Host "`n2. Logging in as admin..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "admin@demo.com"
        password = "demo123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $adminToken = $response.data.tokens.accessToken
    Write-Host "✅ Admin login successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Check AI documents endpoint access
Write-Host "`n3. Testing AI documents endpoint access..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"
    }
    
    $documentsResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/documents" -Method GET -Headers $headers
    $currentDocs = $documentsResponse.data.documents
    Write-Host "✅ AI documents endpoint accessible" -ForegroundColor Green
    Write-Host "   - Current documents: $($currentDocs.Count)" -ForegroundColor White
} catch {
    Write-Host "❌ Failed to access AI documents endpoint: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Create test document
Write-Host "`n4. Creating test document..." -ForegroundColor Yellow
$testContent = @"
NeuroVirtual Device User Manual

1. SETUP GUIDE
To set up your NeuroVirtual device:
- Connect the power cable
- Press the power button
- Wait for the blue LED to turn solid

2. TROUBLESHOOTING
If the device is not working:
- Check power connections
- Restart the device by holding the power button for 10 seconds
- Contact support if issues persist

3. WARRANTY
Your device comes with a 1-year warranty covering manufacturing defects.
"@

$testFilePath = "test-document.txt"
$testContent | Out-File -FilePath $testFilePath -Encoding UTF8
Write-Host "✅ Test document created: $testFilePath" -ForegroundColor Green

# Step 5: Test AI document upload
Write-Host "`n5. Testing AI document upload..." -ForegroundColor Yellow
try {
    # Create multipart form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    # Read file content
    $fileContent = [System.IO.File]::ReadAllBytes($testFilePath)
    $fileName = [System.IO.Path]::GetFileName($testFilePath)
    
    # Create multipart body
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"documents`"; filename=`"$fileName`"",
        "Content-Type: text/plain",
        "",
        [System.Text.Encoding]::UTF8.GetString($fileContent),
        "--$boundary--"
    )
    
    $body = $bodyLines -join $LF
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    
    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }
    
    Write-Host "   - Uploading document..." -ForegroundColor Gray
    $uploadResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/documents" -Method POST -Body $bodyBytes -Headers $headers
    
    if ($uploadResponse.success) {
        Write-Host "✅ Document uploaded successfully!" -ForegroundColor Green
        Write-Host "   - Uploaded: $($uploadResponse.data.uploadedDocuments.Count) documents" -ForegroundColor White
        Write-Host "   - Failed: $($uploadResponse.data.failedDocuments.Count) documents" -ForegroundColor White
        
        if ($uploadResponse.data.uploadedDocuments.Count -gt 0) {
            $doc = $uploadResponse.data.uploadedDocuments[0]
            Write-Host "   - Document ID: $($doc.id)" -ForegroundColor White
            Write-Host "   - File Name: $($doc.fileName)" -ForegroundColor White
            Write-Host "   - File Type: $($doc.fileType)" -ForegroundColor White
            Write-Host "   - Chunks: $($doc.chunkCount)" -ForegroundColor White
        }
    } else {
        Write-Host "❌ Upload failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Upload error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.Exception.Response)" -ForegroundColor Gray
}

# Step 6: Test with curl for comparison
Write-Host "`n6. Testing with curl (if available)..." -ForegroundColor Yellow
try {
    $curlTest = curl --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   - Using curl for upload test..." -ForegroundColor Gray
        $curlResult = curl -X POST "$baseUrl/api/ai-agent/documents" `
            -H "Authorization: Bearer $adminToken" `
            -F "documents=@$testFilePath" `
            --silent --show-error
        
        Write-Host "   - Curl response: $curlResult" -ForegroundColor White
    } else {
        Write-Host "   - Curl not available, skipping" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   - Curl test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Cleanup
Write-Host "`n7. Cleaning up..." -ForegroundColor Yellow
if (Test-Path $testFilePath) {
    Remove-Item $testFilePath
    Write-Host "✅ Test file cleaned up" -ForegroundColor Green
}

Write-Host "`n🎯 TEST COMPLETE" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan 