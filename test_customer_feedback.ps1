# Test customer feedback functionality by creating a ticket like the customer chat does

Write-Host "Testing Customer Feedback Functionality..." -ForegroundColor Cyan

try {
    # Get categories first
    Write-Host "Getting categories..." -ForegroundColor Yellow
    $categoriesResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/categories" -Method GET
    $categories = $categoriesResponse.data.categories
    
    if ($categories.Count -eq 0) {
        Write-Host "No categories available" -ForegroundColor Red
        exit 1
    }
    
    $categoryId = $categories[0].id
    Write-Host "Using category: $($categories[0].name) (ID: $categoryId)" -ForegroundColor Green

    # Create ticket exactly like the backend expects
    Write-Host "Creating ticket like customer chat..." -ForegroundColor Yellow
    
    $requestBody = @{
        title = "Test Feedback Ticket"
        description = "This is a test ticket for feedback functionality"
        priority = "medium"
        categoryId = $categoryId
        customerInfo = @{
            name = "Test Customer"
            email = "test@example.com"
            company = "Test Company"
            phone = "555-0123"
        }
    } | ConvertTo-Json -Depth 3

    Write-Host "Request body:" -ForegroundColor Gray
    Write-Host $requestBody -ForegroundColor Gray
    
    $createResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/tickets" -Method POST -Body $requestBody -ContentType "application/json"
    $ticketId = $createResponse.data.ticket.id
    Write-Host "Created ticket with ID: $ticketId" -ForegroundColor Green

    # Test the feedback endpoint
    Write-Host "Testing feedback submission..." -ForegroundColor Yellow
    $feedbackData = @{
        resolution = "resolved"
    } | ConvertTo-Json

    Write-Host "Submitting feedback to: http://localhost:3001/api/tickets/$ticketId/feedback" -ForegroundColor Gray
    $feedbackResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/tickets/$ticketId/feedback" -Method POST -Body $feedbackData -ContentType "application/json"
    
    Write-Host "✅ Feedback submitted successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    Write-Host ($feedbackResponse | ConvertTo-Json -Depth 3) -ForegroundColor White

    # Test submitting feedback again to see if it works multiple times
    Write-Host "Testing second feedback submission..." -ForegroundColor Yellow
    $feedbackData2 = @{
        resolution = "partially_resolved"
    } | ConvertTo-Json

    $feedbackResponse2 = Invoke-RestMethod -Uri "http://localhost:3001/api/tickets/$ticketId/feedback" -Method POST -Body $feedbackData2 -ContentType "application/json"
    
    Write-Host "✅ Second feedback submitted successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    Write-Host ($feedbackResponse2 | ConvertTo-Json -Depth 3) -ForegroundColor White

} catch {
    Write-Host "❌ Error testing customer feedback:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body: $responseBody" -ForegroundColor Red
        } catch {
            Write-Host "Could not read response body" -ForegroundColor Red
        }
    }
} 