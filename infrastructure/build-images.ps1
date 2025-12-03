# PowerShell script to build and push Docker images for CivicPulse to a container registry

$ErrorActionPreference = "Stop"

# Get the script and project root (assuming script is in infrastructure/)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR

# Get project ID from Pulumi config or environment
$PROJECT_ID = if ($env:GCP_PROJECT) { $env:GCP_PROJECT } else {
    $config = pulumi config get gcp:project 2>$null
    if ($config) { $config } else { "" }
}

# Get Google OAuth Client ID
$GOOGLE_CLIENT_ID = if ($env:GOOGLE_CLIENT_ID) { $env:GOOGLE_CLIENT_ID } else {
    # Try Pulumi CLI first
    $pulumiConfig = pulumi config get civicpulse:googleClientId 2>$null
    if ($pulumiConfig) { 
        $pulumiConfig 
    } else {
        # Fallback: read from Pulumi.dev.yaml
        $configFile = Join-Path $SCRIPT_DIR "Pulumi.dev.yaml"
        if (Test-Path $configFile) {
            $yamlContent = Get-Content $configFile -Raw
            if ($yamlContent -match "civicpulse:googleClientId:\s*(.+)") {
                $matches[1].Trim()
            } else {
                ""
            }
        } else {
            ""
        }
    }
}

if (-not $PROJECT_ID) {
    Write-Host "Error: GCP project ID not set. Set GCP_PROJECT env var or run 'pulumi config set gcp:project YOUR_PROJECT_ID'" -ForegroundColor Red
    exit 1
}

# Determine image registry base (e.g. us-central1-docker.pkg.dev/PROJECT/civicpulse or gcr.io/PROJECT)
$IMAGE_BASE = if ($env:IMAGE_BASE) { 
    $env:IMAGE_BASE 
} else {
    $cfg = pulumi config get civicpulse:imageRegistry 2>$null
    if ($cfg) { 
        $cfg 
    } else {
        "us-central1-docker.pkg.dev/$PROJECT_ID/civicpulse"
    }
}

Write-Host "Building images for project: $PROJECT_ID" -ForegroundColor Green
Write-Host "Image registry base: $IMAGE_BASE" -ForegroundColor Green
if ($GOOGLE_CLIENT_ID) {
    Write-Host "Google Client ID: set" -ForegroundColor Green
}

# Authenticate Docker with the registry host (Artifact Registry)
Write-Host "Configuring Docker for Artifact Registry..." -ForegroundColor Yellow
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet

# Frontend
Write-Host "Building frontend image..." -ForegroundColor Yellow
docker build -t "$IMAGE_BASE/civicpulse-frontend:latest" `
    --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" `
    -f "$PROJECT_ROOT\civicpulse\src\Dockerfile" `
    "$PROJECT_ROOT\civicpulse"

Write-Host "Pushing frontend image..." -ForegroundColor Yellow
docker push "$IMAGE_BASE/civicpulse-frontend:latest"

# Ingestion
Write-Host "Building ingestion image..." -ForegroundColor Yellow
docker build -t "$IMAGE_BASE/civicpulse-ingestion:latest" `
    -f "$PROJECT_ROOT\civicpulse\src\ingestion\Dockerfile" `
    "$PROJECT_ROOT\civicpulse\src\ingestion"

Write-Host "Pushing ingestion image..." -ForegroundColor Yellow
docker push "$IMAGE_BASE/civicpulse-ingestion:latest"

# Processing
Write-Host "Building processing image..." -ForegroundColor Yellow
docker build -t "$IMAGE_BASE/civicpulse-processing:latest" `
    -f "$PROJECT_ROOT\civicpulse\src\processing\Dockerfile" `
    "$PROJECT_ROOT\civicpulse\src\processing"

Write-Host "Pushing processing image..." -ForegroundColor Yellow
docker push "$IMAGE_BASE/civicpulse-processing:latest"

# LM Parser
Write-Host "Building lm-parser image..." -ForegroundColor Yellow
docker build -t "$IMAGE_BASE/civicpulse-lm-parser:latest" `
    -f "$PROJECT_ROOT\civicpulse\src\lm_parser\Dockerfile" `
    "$PROJECT_ROOT\civicpulse\src\lm_parser"

Write-Host "Pushing lm-parser image..." -ForegroundColor Yellow
docker push "$IMAGE_BASE/civicpulse-lm-parser:latest"

Write-Host "All images built and pushed successfully!" -ForegroundColor Green

