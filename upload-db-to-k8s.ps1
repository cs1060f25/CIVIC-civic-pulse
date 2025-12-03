# Script to upload database to Kubernetes
# Usage: .\upload-db-to-k8s.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Uploading Database to Kubernetes ===" -ForegroundColor Green

$dbPath = "backend\db\civicpulse.db"
$namespace = "civicpulse-104c2bda"

# Check if database exists
if (-not (Test-Path $dbPath)) {
    Write-Host "ERROR: Database not found at $dbPath" -ForegroundColor Red
    exit 1
}

$dbSize = (Get-Item $dbPath).Length / 1MB
Write-Host "Database size: $([math]::Round($dbSize, 2)) MB" -ForegroundColor Cyan

# Get a pod to copy to
Write-Host "`nGetting a pod for database upload..." -ForegroundColor Yellow
$pod = kubectl get pods -n $namespace -l app=frontend -o jsonpath='{.items[0].metadata.name}' 2>$null

if (-not $pod) {
    Write-Host "ERROR: No frontend pod found in namespace $namespace" -ForegroundColor Red
    Write-Host "Creating a temporary pod for upload..." -ForegroundColor Yellow
    
    # Create a temporary pod
    kubectl run upload-db-pod -n $namespace --image=busybox --restart=Never -- sleep 3600
    Start-Sleep -Seconds 3
    kubectl wait --for=condition=ready pod/upload-db-pod -n $namespace --timeout=30s
    
    $pod = "upload-db-pod"
}

Write-Host "Using pod: $pod" -ForegroundColor Cyan

# Copy database
Write-Host "`nCopying database to pod..." -ForegroundColor Yellow
kubectl cp $dbPath "$namespace/$pod`:/app/backend/db/civicpulse.db"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to copy database" -ForegroundColor Red
    exit 1
}

Write-Host "Database copied successfully!" -ForegroundColor Green

# Verify the copy
Write-Host "`nVerifying database in pod..." -ForegroundColor Yellow
kubectl exec -n $namespace $pod -- ls -lh /app/backend/db/civicpulse.db

# Restart frontend pods to pick up new database
Write-Host "`nRestarting frontend pods..." -ForegroundColor Yellow
kubectl rollout restart deployment/frontend -n $namespace
kubectl rollout status deployment/frontend -n $namespace --timeout=60s

# Clean up temporary pod if we created one
if ($pod -eq "upload-db-pod") {
    Write-Host "`nCleaning up temporary pod..." -ForegroundColor Yellow
    kubectl delete pod upload-db-pod -n $namespace
}

Write-Host "`n=== Upload Complete ===" -ForegroundColor Green
Write-Host "Database has been uploaded and frontend pods have been restarted." -ForegroundColor Cyan

