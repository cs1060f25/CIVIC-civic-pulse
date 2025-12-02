# Script to create the Kubernetes cluster
# Run this after Pulumi is installed

Write-Host "Creating GKE Cluster..." -ForegroundColor Green
Write-Host "Project: civic-pulse-480006" -ForegroundColor Cyan
Write-Host "Region: us-central1" -ForegroundColor Cyan
Write-Host "Node: 1x e2-standard-4 (16GB RAM)" -ForegroundColor Cyan
Write-Host ""

# Check if Pulumi is installed
try {
    $pulumiVersion = pulumi version 2>&1
    Write-Host "Pulumi found: $pulumiVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Pulumi is not installed!" -ForegroundColor Red
    Write-Host "Please install Pulumi first. See INSTALL_PULUMI.md" -ForegroundColor Yellow
    exit 1
}

# Check GCP authentication
try {
    $project = gcloud config get-value project 2>&1
    if ($project -ne "civic-pulse-480006") {
        Write-Host "Setting GCP project to civic-pulse-480006..." -ForegroundColor Yellow
        gcloud config set project civic-pulse-480006
    }
    Write-Host "GCP Project: $project" -ForegroundColor Green
} catch {
    Write-Host "ERROR: gcloud not configured!" -ForegroundColor Red
    Write-Host "Run: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

# Navigate to infrastructure directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Login to Pulumi (if not already)
Write-Host "`nLogging into Pulumi..." -ForegroundColor Yellow
pulumi login

# Initialize stack (if not exists)
Write-Host "`nInitializing Pulumi stack..." -ForegroundColor Yellow
pulumi stack select dev 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating new stack 'dev'..." -ForegroundColor Yellow
    pulumi stack init dev
}

# Set configuration
Write-Host "`nSetting Pulumi configuration..." -ForegroundColor Yellow
pulumi config set gcp:project civic-pulse-480006 --plaintext
pulumi config set gcp:region us-central1 --plaintext
pulumi config set civicpulse:gkeClusterName civicpulse-cluster --plaintext
pulumi config set civicpulse:googleClientId 1001250868106-0o3neevihvufp7nf2md52s96brp6s3s8.apps.googleusercontent.com --plaintext

# Preview changes
Write-Host "`nPreviewing changes..." -ForegroundColor Yellow
pulumi preview

# Confirm deployment
Write-Host "`nReady to create cluster!" -ForegroundColor Green
$confirm = Read-Host "Do you want to proceed? (yes/no)"
if ($confirm -eq "yes" -or $confirm -eq "y") {
    Write-Host "`nCreating cluster (this will take 5-10 minutes)..." -ForegroundColor Yellow
    pulumi up --yes
    Write-Host "`nCluster creation complete!" -ForegroundColor Green
    Write-Host "`nGet frontend URL:" -ForegroundColor Cyan
    Write-Host "  pulumi stack output frontendUrl" -ForegroundColor White
} else {
    Write-Host "Cancelled." -ForegroundColor Yellow
}

