# Script to link processed documents to their PDF files
# Updates file_url in database to point to actual PDF location

$ErrorActionPreference = "Stop"

Write-Host "=== Linking PDFs to Documents ===" -ForegroundColor Green

$dbPath = "backend\db\civicpulse.db"
$pdfBaseDir = "backend\data\raw notes\Wichita"

# Check if database exists
if (-not (Test-Path $dbPath)) {
    Write-Host "ERROR: Database not found at $dbPath" -ForegroundColor Red
    exit 1
}

# Check if PDF directory exists
if (-not (Test-Path $pdfBaseDir)) {
    Write-Host "ERROR: PDF directory not found at $pdfBaseDir" -ForegroundColor Red
    exit 1
}

# Get all PDFs
$pdfs = Get-ChildItem $pdfBaseDir -Recurse -File -Filter "*.pdf"
Write-Host "Found $($pdfs.Count) PDF files" -ForegroundColor Cyan

# Create a mapping of filename (without extension) to full path
$pdfMap = @{}
foreach ($pdf in $pdfs) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($pdf.Name)
    # Normalize the name (remove common variations)
    $normalized = $baseName -replace '_', '-' -replace ' ', '-'
    
    # Store both original and normalized
    if (-not $pdfMap.ContainsKey($baseName)) {
        $pdfMap[$baseName] = @()
    }
    $pdfMap[$baseName] += $pdf.FullName
    
    # Also try normalized version
    if ($normalized -ne $baseName) {
        if (-not $pdfMap.ContainsKey($normalized)) {
            $pdfMap[$normalized] = @()
        }
        $pdfMap[$normalized] += $pdf.FullName
    }
}

Write-Host "Created PDF mapping with $($pdfMap.Keys.Count) unique names" -ForegroundColor Cyan

# Update database
$updated = 0
$notFound = 0

# Get all documents from database
$documents = sqlite3 $dbPath "SELECT id, file_url FROM documents;" | ConvertFrom-Csv -Delimiter "|" -Header "id", "file_url"

Write-Host "`nProcessing $($documents.Count) documents..." -ForegroundColor Yellow

foreach ($doc in $documents) {
    # Extract filename from current file_url (format: local:test_txt_files/Wichita_01-07-2025_Agenda.txt)
    if ($doc.file_url -match "local:(.+)\.txt$") {
        $txtPath = $matches[1]
        $txtFileName = [System.IO.Path]::GetFileName($txtPath)
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($txtFileName)
        
        # Try to find matching PDF
        $matchingPdf = $null
        
        # Try exact match first
        if ($pdfMap.ContainsKey($baseName)) {
            $matchingPdf = $pdfMap[$baseName][0]  # Take first match
        } else {
            # Try variations - remove common suffixes/prefixes
            $variations = @(
                $baseName,
                $baseName -replace '^Wichita_', '',
                $baseName -replace '-', '_',
                $baseName -replace '_', '-',
                ($baseName -split '_')[0..2] -join '_',  # First 3 parts
                ($baseName -split '-')[0..2] -join '-',  # First 3 parts
                ($baseName -split '_')[1..3] -join '_'   # Skip first part
            )
            
            foreach ($var in $variations) {
                if ($var -and $pdfMap.ContainsKey($var)) {
                    $matchingPdf = $pdfMap[$var][0]
                    break
                }
            }
        }
        
        if ($matchingPdf) {
            # Convert to relative path from repo root, using forward slashes for file:/// URL
            $relativePath = $matchingPdf -replace [regex]::Escape($PWD.Path + "\"), "" -replace "\\", "/"
            # Escape single quotes for SQL
            $escapedUrl = $relativePath.Replace("'", "''")
            $newUrl = "file:///$escapedUrl"
            
            # Update database
            sqlite3 $dbPath "UPDATE documents SET file_url = '$newUrl' WHERE id = '$($doc.id)';"
            $updated++
            Write-Host "  Updated: $baseName -> $([System.IO.Path]::GetFileName($matchingPdf))" -ForegroundColor Green
        } else {
            $notFound++
            Write-Host "  Not found: $baseName" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Green
Write-Host "Updated: $updated documents" -ForegroundColor Cyan
Write-Host "Not found: $notFound documents" -ForegroundColor Yellow
Write-Host "`nDatabase updated with PDF file URLs" -ForegroundColor Green

