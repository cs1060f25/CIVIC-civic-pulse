# CivicPulse Infrastructure

This directory contains Pulumi infrastructure code for deploying CivicPulse to GCP Kubernetes (GKE).

## Prerequisites

1. **Pulumi CLI**: Install from https://www.pulumi.com/docs/get-started/install/
2. **GCP CLI**: Install and configure `gcloud`
3. **Node.js**: Version 18+ required
4. **GKE Cluster**: An existing GKE cluster (or modify `index.ts` to create one)

## Setup

1. **Install dependencies**:
   ```bash
   cd infrastructure
   npm install
   ```

2. **Configure Pulumi**:
   ```bash
   pulumi stack init dev
   # Project ID is already set in Pulumi.dev.yaml
   pulumi config set civicpulse:googleClientId YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
   ```
   
   **Important**: Get your Google OAuth Client ID from Google Cloud Console. See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for detailed instructions.

3. **Set up GCP authentication**:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

4. **Build and push Docker images**:
   
   First, configure Docker to use GCR:
   ```bash
   gcloud auth configure-docker
   ```
   
   Build and push each image:
   ```bash
   # From project root
   PROJECT_ID=$(pulumi config get gcp:project)
   
   # Frontend
   docker build -t gcr.io/$PROJECT_ID/civicpulse-frontend:latest \
     --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=$(pulumi config get civicpulse:googleClientId) \
     -f civicpulse/src/Dockerfile civicpulse/src
   docker push gcr.io/$PROJECT_ID/civicpulse-frontend:latest
   
   # Ingestion
   docker build -t gcr.io/$PROJECT_ID/civicpulse-ingestion:latest \
     -f civicpulse/src/ingestion/Dockerfile civicpulse/src/ingestion
   docker push gcr.io/$PROJECT_ID/civicpulse-ingestion:latest
   
   # Processing
   docker build -t gcr.io/$PROJECT_ID/civicpulse-processing:latest \
     -f civicpulse/src/processing/Dockerfile civicpulse/src/processing
   docker push gcr.io/$PROJECT_ID/civicpulse-processing:latest
   
   # LM Parser
   docker build -t gcr.io/$PROJECT_ID/civicpulse-lm-parser:latest \
     -f civicpulse/src/lm_parser/Dockerfile civicpulse/src/lm_parser
   docker push gcr.io/$PROJECT_ID/civicpulse-lm-parser:latest
   ```

5. **Set Google API Key secret** (if using lm-parser):
   ```bash
   # Create secret file
   echo -n "YOUR_API_KEY" > /tmp/google_api_key.txt
   
   # Create Kubernetes secret manually or use Pulumi config
   kubectl create secret generic google-api-key \
     --from-file=google_api_key.txt=/tmp/google_api_key.txt \
     --namespace=civicpulse
   ```

## Deploy

1. **Preview changes**:
   ```bash
   pulumi preview
   ```

2. **Deploy** (this will create the GKE cluster and all resources):
   ```bash
   pulumi up
   ```
   
   **Note**: Cluster creation takes 5-10 minutes. The first deployment will be slower.

3. **Get frontend URL**:
   ```bash
   pulumi stack output frontendUrl
   ```
   
   This will show the URL to access your application (e.g., `http://34.123.45.67`)

4. **Update Google OAuth settings**:
   After getting the frontend URL, add it to Google Cloud Console OAuth settings. See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for details.

## Update Images

When you update code and rebuild images:

1. Rebuild and push images (see Setup step 4)
2. Restart deployments:
   ```bash
   kubectl rollout restart deployment/frontend -n civicpulse
   kubectl rollout restart deployment/ingestion -n civicpulse
   kubectl rollout restart deployment/processing -n civicpulse
   kubectl rollout restart deployment/lm-parser -n civicpulse
   ```

Or update the image tag in `index.ts` and run `pulumi up`.

## Destroy

To tear down all resources:
```bash
pulumi destroy
```

## Notes

- **Persistent Volumes**: The infrastructure creates PVCs for shared backend data. Ensure your GKE cluster has a storage class that supports `ReadWriteMany` access mode, or update the storage class in `index.ts`.
- **Database Initialization**: The database file needs to be initialized. You may need to run an init job or manually initialize the database in the PVC.
- **Secrets**: Google API key should be set up as a Kubernetes secret before deployment.
- **Load Balancer**: The frontend service uses a LoadBalancer type, which will create a GCP load balancer and assign an external IP.

