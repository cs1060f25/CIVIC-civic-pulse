# Script to process documents and upload to Kubernetes
# Usage: .\process-documents.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Processing Documents with LM Parser (Docker) ===" -ForegroundColor Green

# Paths
$inputDir = "C:\Users\stefa\OneDrive - Harvard University\Desktop\Fall 2025\CIVIC-civic-pulse\backend\data\test_txt_files-20251113T194925Z-1-001"
$pdfDir = "C:\Users\stefa\OneDrive - Harvard University\Desktop\Fall 2025\CIVIC-civic-pulse\backend\data\raw notes\Wichita"
$dbPath = "backend\db\civicpulse.db"
$parserScript = "civicpulse\src\lm_parser\parse_documents.py"

# Check if database exists
if (Test-Path $dbPath) {
    Write-Host "Database exists at: $dbPath" -ForegroundColor Yellow
} else {
    Write-Host "ERROR: Database not found at $dbPath" -ForegroundColor Red
    Write-Host "Please initialize it first with: Get-Content backend\db\schema.sql | sqlite3 backend\db\civicpulse.db" -ForegroundColor Yellow
    exit 1
}

# Check if input directory exists
if (-not (Test-Path $inputDir)) {
    Write-Host "ERROR: Input directory not found: $inputDir" -ForegroundColor Red
    exit 1
}

# Count files
$fileCount = (Get-ChildItem $inputDir -Recurse -File -Filter "*.txt").Count
Write-Host "Found $fileCount .txt files to process" -ForegroundColor Cyan

# Check if secrets directory exists for API key
$secretsDir = "..\secrets"
$apiKeyFile = "$secretsDir\google_api_key.txt"
if (-not (Test-Path $apiKeyFile)) {
    # Try absolute path
    $apiKeyFile = "C:\Users\stefa\OneDrive - Harvard University\Desktop\Fall 2025\secrets\google_api_key.txt"
    if (-not (Test-Path $apiKeyFile)) {
        Write-Host "ERROR: API key file not found at expected location" -ForegroundColor Red
        Write-Host "Expected: $secretsDir\google_api_key.txt or the absolute path" -ForegroundColor Yellow
        exit 1
    }
}

# Build the Docker image first
Write-Host "`nBuilding Docker image for lm-parser..." -ForegroundColor Yellow
cd civicpulse\src\lm_parser
docker build -t civicpulse-lm-parser:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker build failed" -ForegroundColor Red
    cd ..\..\..
    exit 1
}
cd ..\..\..

# Run the parser in Docker
Write-Host "`nRunning LM parser in Docker..." -ForegroundColor Yellow
Write-Host "This may take a while depending on the number of files..." -ForegroundColor Yellow

# Resolve absolute paths for Docker volumes (Windows needs full paths)
$inputDirAbs = (Resolve-Path $inputDir).Path
$pdfDirAbs = (Resolve-Path $pdfDir).Path
$dbPathAbs = (Resolve-Path $dbPath).Path
$apiKeyFileAbs = (Resolve-Path $apiKeyFile).Path
$topicsCsvAbs = (Resolve-Path "backend\data\topics.csv").Path

# Get the directory containing the database (Docker needs directory, not file for volume)
$dbDir = Split-Path $dbPathAbs -Parent

Write-Host "Input directory: $inputDirAbs" -ForegroundColor Cyan
Write-Host "Database directory: $dbDir" -ForegroundColor Cyan

# Mount volumes outside /app to avoid package discovery issues
# Use /input for input files, mount db and topics to expected locations
docker run --rm `
    --entrypoint /bin/bash `
    -v "${inputDirAbs}:/input:ro" `
    -v "${pdfDirAbs}:/pdfs:ro" `
    -v "${dbDir}:/app/backend/db" `
    -v "${apiKeyFileAbs}:/run/secrets/google_api_key.txt:ro" `
    -v "${topicsCsvAbs}:/app/backend/data/topics.csv:ro" `
    -e GOOGLE_API_KEY_PATH=/run/secrets/google_api_key.txt `
    -e CIVICPULSE_DB_PATH=/app/backend/db/civicpulse.db `
    -w /app `
    civicpulse-lm-parser:latest `
    -c "export GOOGLE_API_KEY=`$(cat /run/secrets/google_api_key.txt | tr -d '\r\n' | xargs) && uv run python parse_documents.py --input_dir /input --pdf_dir /pdfs --db_path /app/backend/db/civicpulse.db --model gemini-2.5-flash --source_id local_processing --url_prefix 'local:' --mode txt"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Parser failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Parser completed successfully ===" -ForegroundColor Green

# Check database size
$dbSize = (Get-Item $dbPath).Length / 1MB
Write-Host "Database size: $([math]::Round($dbSize, 2)) MB" -ForegroundColor Cyan

# Count documents
$docCount = sqlite3 $dbPath "SELECT COUNT(*) FROM documents;"
Write-Host "Documents in database: $docCount" -ForegroundColor Cyan

Write-Host "`n=== Ready to upload to Kubernetes ===" -ForegroundColor Green
Write-Host "Next step: Copy database to Kubernetes using kubectl cp" -ForegroundColor Yellow

