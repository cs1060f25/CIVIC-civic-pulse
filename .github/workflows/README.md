# GitHub Actions CI/CD Setup

This directory contains GitHub Actions workflows for automated deployment to GCP Kubernetes.

## Workflows

### `deploy.yml`

Automatically deploys to Kubernetes when changes are pushed to the `main` branch.

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch (via GitHub UI)

**What it does:**
1. Builds all 4 Docker images (frontend, ingestion, processing, lm-parser)
2. Pushes images to Google Container Registry (GCR)
3. Deploys infrastructure using Pulumi
4. Updates Kubernetes deployments with new images

## Required GitHub Secrets

You need to configure these secrets in your GitHub repository:

### 1. `GCP_SA_KEY` (Required)

Service Account JSON key for GCP authentication.

**How to create:**
```bash
# Create a service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account" \
  --project=civic-pulse-480006

# Grant necessary permissions
gcloud projects add-iam-policy-binding civic-pulse-480006 \
  --member="serviceAccount:github-actions@civic-pulse-480006.iam.gserviceaccount.com" \
  --role="roles/container.admin"

gcloud projects add-iam-policy-binding civic-pulse-480006 \
  --member="serviceAccount:github-actions@civic-pulse-480006.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding civic-pulse-480006 \
  --member="serviceAccount:github-actions@civic-pulse-480006.iam.gserviceaccount.com" \
  --role="roles/compute.admin"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@civic-pulse-480006.iam.gserviceaccount.com \
  --project=civic-pulse-480006

# Copy the contents of github-actions-key.json
cat github-actions-key.json
```

**Add to GitHub:**
1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `GCP_SA_KEY`
4. Value: Paste the entire JSON content from `github-actions-key.json`

### 2. `PULUMI_ACCESS_TOKEN` (Required)

Pulumi access token for managing infrastructure state.

**How to create:**
1. Go to https://app.pulumi.com/account/tokens
2. Click "Create token"
3. Give it a name (e.g., "GitHub Actions")
4. Copy the token

**Add to GitHub:**
1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `PULUMI_ACCESS_TOKEN`
4. Value: Paste the token

## Setup Instructions

### Step 1: Create Service Account and Key

Run the commands above to create the GCP service account and download the key.

### Step 2: Add Secrets to GitHub

Add both `GCP_SA_KEY` and `PULUMI_ACCESS_TOKEN` as repository secrets.

### Step 3: Initialize Pulumi Stack (if not done)

The workflow will automatically create the stack if it doesn't exist, but you can also do it manually:

```bash
cd infrastructure
pulumi stack init dev
pulumi config set gcp:project civic-pulse-480006
pulumi config set civicpulse:googleClientId YOUR_CLIENT_ID
```

### Step 4: Test the Workflow

1. Push a small change to `main` branch
2. Go to GitHub → Actions tab
3. Watch the workflow run
4. Check deployment logs

## How It Works

1. **On push to main:**
   - Workflow triggers automatically

2. **Build phase:**
   - Checks out code
   - Sets up Node.js, Pulumi, and GCloud
   - Authenticates with GCP
   - Builds all Docker images
   - Tags images with commit SHA and `latest`
   - Pushes to GCR

3. **Deploy phase:**
   - Installs Pulumi dependencies
   - Configures Pulumi stack
   - Runs `pulumi preview` to show changes
   - Runs `pulumi up` to deploy
   - Outputs frontend URL

4. **Kubernetes updates:**
   - Pulumi updates the deployments with new image tags
   - Kubernetes automatically pulls new images
   - Pods restart with new code

## Image Tagging Strategy

- **Commit SHA**: `civicpulse-frontend:${{ github.sha }}` - Unique per commit
- **Latest**: `civicpulse-frontend:latest` - Always points to most recent

The Pulumi configuration uses `:latest` tag, so each deployment pulls the newest image.

## Updating Image Tags in Pulumi

If you want to use commit SHA tags instead of `latest`, update `infrastructure/index.ts`:

```typescript
const frontendImage = `${imageRegistry}/${project}/civicpulse-frontend:${process.env.GITHUB_SHA || 'latest'}`;
```

Then add to workflow:
```yaml
env:
  GITHUB_SHA: ${{ github.sha }}
```

## Troubleshooting

### Workflow fails with "permission denied"
- Check that `GCP_SA_KEY` secret is set correctly
- Verify service account has required roles
- Check JSON key format (should be valid JSON)

### Pulumi fails with "stack not found"
- The workflow will create the stack automatically
- Or create it manually: `pulumi stack init dev`

### Images not found in GCR
- Check that images were pushed: `gcloud container images list --repository=gcr.io/civic-pulse-480006`
- Verify Docker build succeeded in workflow logs
- Check GCR permissions

### Deployment doesn't update
- Check Pulumi preview output in workflow logs
- Verify image tags match what's in `index.ts`
- Check Kubernetes pod logs: `kubectl logs -n civicpulse deployment/frontend`

## Manual Deployment

You can also trigger the workflow manually:

1. Go to GitHub → Actions tab
2. Select "Deploy to Kubernetes" workflow
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

## Security Best Practices

- ✅ Service account has minimal required permissions
- ✅ Secrets are stored securely in GitHub Secrets
- ✅ Pulumi state is encrypted
- ✅ Images are scanned by GCR (enable in GCP Console)
- ⚠️ Consider using Workload Identity Federation instead of service account keys (more secure)

## Cost Considerations

- GitHub Actions: Free for public repos, 2000 minutes/month for private repos
- GCR storage: ~$0.026/GB/month
- Image builds: No additional cost (runs on GitHub runners)

## Next Steps

1. Set up the secrets (see above)
2. Push a test change to `main`
3. Monitor the workflow run
4. Verify deployment in Kubernetes

For more details, see the main [infrastructure README](../infrastructure/README.md).

