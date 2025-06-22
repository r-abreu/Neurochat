# Test script for fuzzy company matching
$baseUrl = "http://localhost:3001/api"

# First, login as admin to get a token
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body (@{
    email = "admin@demo.com"
    password = "demo123"
} | ConvertTo-Json) -ContentType "application/json"

Write-Host "Login successful. Token obtained."
$token = $loginResponse.data.tokens.accessToken

# Headers for authenticated requests
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Get categories first
Write-Host "`nGetting categories..."
$categoriesResponse = Invoke-RestMethod -Uri "$baseUrl/categories" -Method GET -Headers $headers
$categoryId = $categoriesResponse.data.categories[0].id
Write-Host "Using category ID: $categoryId"

# Create a test ticket with a company name that should match "NeuroVirtual Inc."
Write-Host "`nCreating test ticket with company name 'Neurovirtual USA'..."
$ticketData = @{
    title = "Test Fuzzy Company Matching"
    description = "This is a test ticket for fuzzy company matching"
    categoryId = $categoryId
    priority = "medium"
    customerInfo = @{
        name = "John Doe"
        email = "john.doe@test.com"
        company = "Neurovirtual USA"  # This should match "NeuroVirtual Inc." with high confidence
        phone = "555-1234"
        country = "United States"
    }
}

try {
    $ticketResponse = Invoke-RestMethod -Uri "$baseUrl/tickets" -Method POST -Body ($ticketData | ConvertTo-Json) -Headers $headers
    $ticketId = $ticketResponse.data.ticket.id
    Write-Host "Ticket created successfully. ID: $ticketId"
    
    # Update the ticket status to resolved to trigger fuzzy matching
    Write-Host "`nResolving ticket to trigger fuzzy matching..."
    $updateData = @{
        status = "resolved"
    }
    
    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/tickets/$ticketId" -Method PUT -Body ($updateData | ConvertTo-Json) -Headers $headers
    Write-Host "Ticket status updated to resolved."
    
    # Wait a moment for the fuzzy matching to process
    Start-Sleep -Seconds 2
    
    # Check for pending company matches
    Write-Host "`nChecking for pending company matches..."
    $pendingMatches = Invoke-RestMethod -Uri "$baseUrl/companies/pending-matches" -Method GET -Headers $headers
    
    if ($pendingMatches.data.Count -gt 0) {
        Write-Host "Found $($pendingMatches.data.Count) pending company match(es):"
        foreach ($match in $pendingMatches.data) {
            Write-Host "  - Input: '$($match.inputCompanyName)'"
            Write-Host "  - Suggested: '$($match.suggestedCompany.name)'"
            Write-Host "  - Confidence: $($match.confidence)%"
            Write-Host "  - Ticket: #$($match.ticket.ticketNumber)"
            Write-Host ""
        }
        
        # Test approving the first match
        if ($pendingMatches.data.Count -gt 0) {
            $firstMatch = $pendingMatches.data[0]
            Write-Host "Testing approval of first match..."
            $approveData = @{
                action = "approve"
            }
            
            $approveResponse = Invoke-RestMethod -Uri "$baseUrl/companies/pending-matches/$($firstMatch.id)/review" -Method POST -Body ($approveData | ConvertTo-Json) -Headers $headers
            Write-Host "Match approved successfully: $($approveResponse.message)"
        }
    } else {
        Write-Host "No pending company matches found."
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Response: $($_.Exception.Response | ConvertTo-Json -Depth 3)"
}

Write-Host "`nTest completed." 