#!/bin/bash
# Build and push Docker images for CivicPulse to GCR

set -e

# Get project ID from Pulumi config or environment
PROJECT_ID=${GCP_PROJECT:-$(pulumi config get gcp:project 2>/dev/null || echo "")}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-$(pulumi config get civicpulse:googleClientId 2>/dev/null || echo "")}

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP project ID not set. Set GCP_PROJECT env var or run 'pulumi config set gcp:project YOUR_PROJECT_ID'"
    exit 1
fi

echo "Building images for project: $PROJECT_ID"
echo "Google Client ID: ${GOOGLE_CLIENT_ID:+set}"

# Authenticate Docker with GCR
echo "Configuring Docker for GCR..."
gcloud auth configure-docker --quiet

# Get the project root (assuming script is in infrastructure/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Frontend
echo "Building frontend image..."
docker build -t gcr.io/$PROJECT_ID/civicpulse-frontend:latest \
    --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
    -f "$PROJECT_ROOT/civicpulse/src/Dockerfile" \
    "$PROJECT_ROOT/civicpulse/src"

echo "Pushing frontend image..."
docker push gcr.io/$PROJECT_ID/civicpulse-frontend:latest

# Ingestion
echo "Building ingestion image..."
docker build -t gcr.io/$PROJECT_ID/civicpulse-ingestion:latest \
    -f "$PROJECT_ROOT/civicpulse/src/ingestion/Dockerfile" \
    "$PROJECT_ROOT/civicpulse/src/ingestion"

echo "Pushing ingestion image..."
docker push gcr.io/$PROJECT_ID/civicpulse-ingestion:latest

# Processing
echo "Building processing image..."
docker build -t gcr.io/$PROJECT_ID/civicpulse-processing:latest \
    -f "$PROJECT_ROOT/civicpulse/src/processing/Dockerfile" \
    "$PROJECT_ROOT/civicpulse/src/processing"

echo "Pushing processing image..."
docker push gcr.io/$PROJECT_ID/civicpulse-processing:latest

# LM Parser
echo "Building lm-parser image..."
docker build -t gcr.io/$PROJECT_ID/civicpulse-lm-parser:latest \
    -f "$PROJECT_ROOT/civicpulse/src/lm_parser/Dockerfile" \
    "$PROJECT_ROOT/civicpulse/src/lm_parser"

echo "Pushing lm-parser image..."
docker push gcr.io/$PROJECT_ID/civicpulse-lm-parser:latest

echo "All images built and pushed successfully!"

