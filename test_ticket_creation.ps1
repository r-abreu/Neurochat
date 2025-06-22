# Test script for ticket creation with company association
$baseUrl = "http://localhost:3001/api"

# First, login as admin to get a token
Write-Host "Logging in as admin..."
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
Write-Host "`nCreating test ticket with company name 'NeuroVirtual USA' and device information..."
$ticketData = @{
    title = "Test Device Issue - Audio Problems"
    description = "The device is not producing clear audio output. Need assistance with troubleshooting."
    categoryId = $categoryId
    priority = "medium"
    customerInfo = @{
        name = "John Smith"
        email = "john.smith@neurovirtual.com"
        phone = "555-1234-5678"
        company = "NeuroVirtual USA"  # This should match "NeuroVirtual Inc." with high confidence
        streetAddress = "123 Tech Street"
        city = "San Francisco"
        state = "California"
        zipCode = "94105"
        country = "United States"
        customerType = "VIP"
        deviceModel = "BWIII"
        deviceSerialNumber = "BW3-2024-001234"
    }
}

try {
    $ticketResponse = Invoke-RestMethod -Uri "$baseUrl/tickets" -Method POST -Body ($ticketData | ConvertTo-Json -Depth 5) -Headers $headers
    $ticketId = $ticketResponse.data.ticket.id
    Write-Host "✅ Ticket created successfully!"
    Write-Host "  - Ticket ID: $ticketId"
    Write-Host "  - Ticket Number: $($ticketResponse.data.ticket.ticketNumber)"
    Write-Host "  - Customer Name: $($ticketResponse.data.ticket.customerName)"
    Write-Host "  - Customer Company: $($ticketResponse.data.ticket.customerCompany)"
    Write-Host "  - Device Model: $($ticketResponse.data.ticket.deviceModel)"
    Write-Host "  - Device Serial: $($ticketResponse.data.ticket.deviceSerialNumber)"
    Write-Host "  - Company ID: $($ticketResponse.data.ticket.companyId)"
    
    # Wait a moment for any background processing
    Start-Sleep -Seconds 3
    
    # Get the ticket details to verify the associations
    Write-Host "`nRetrieving ticket details to verify associations..."
    $ticketDetails = Invoke-RestMethod -Uri "$baseUrl/tickets/$ticketId" -Method GET -Headers $headers
    
    Write-Host "📋 Ticket Details:"
    Write-Host "  - Customer Name: $($ticketDetails.data.ticket.customerName)"
    Write-Host "  - Customer Company: $($ticketDetails.data.ticket.customerCompany)"
    Write-Host "  - Company ID: $($ticketDetails.data.ticket.companyId)"
    Write-Host "  - Device Model: $($ticketDetails.data.ticket.deviceModel)"
    Write-Host "  - Device Serial: $($ticketDetails.data.ticket.deviceSerialNumber)"
    
    # Check if devices were created/linked
    Write-Host "`nChecking devices..."
    try {
        $devicesResponse = Invoke-RestMethod -Uri "$baseUrl/devices" -Method GET -Headers $headers
        $relatedDevices = $devicesResponse.data.devices | Where-Object { $_.serialNumber -eq "BW3-2024-001234" }
        
        if ($relatedDevices) {
            Write-Host "🔧 Device found:"
            foreach ($device in $relatedDevices) {
                Write-Host "  - Device ID: $($device.id)"
                Write-Host "  - Serial Number: $($device.serialNumber)"
                Write-Host "  - Model: $($device.model)"
                Write-Host "  - Customer ID: $($device.customerId)"
                Write-Host "  - Company ID: $($device.companyId)"
            }
        } else {
            Write-Host "❌ No matching device found"
        }
    } catch {
        Write-Host "⚠️  Could not retrieve devices (permission issue or error)"
    }
    
    # Verify company association worked
    if ($ticketDetails.data.ticket.companyId) {
        Write-Host "`n✅ SUCCESS: Company association worked automatically!"
        Write-Host "  Company was matched and assigned during ticket creation."
    } else {
        Write-Host "`n⚠️  Company not automatically assigned. This may be expected for lower confidence matches."
    }
    
} catch {
    Write-Host "❌ Error creating or retrieving ticket:"
    Write-Host "  Message: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody"
    }
}

Write-Host "`n�� Test completed." 