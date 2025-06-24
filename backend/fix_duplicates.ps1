# Fix duplicate lines in server.js
$inputFile = "server.js"
$outputFile = "server_fixed.js"

# Read all lines
$lines = Get-Content $inputFile

# Keep lines 1-802 and lines 1636 to end
$fixedLines = @()
$fixedLines += $lines[0..801]  # Lines 1-802 (0-indexed)
$fixedLines += $lines[1635..($lines.Length-1)]  # Lines 1636 to end

# Write fixed content
$fixedLines | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "Fixed server.js saved as server_fixed.js"
Write-Host "Lines removed: 803-1635 (duplicate section)" 