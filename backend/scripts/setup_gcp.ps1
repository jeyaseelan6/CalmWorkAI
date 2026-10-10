# ==============================================================================
# CalmWork AI — GCP Setup & Credit Activation PowerShell Script (Windows)
# Sets up all Google Cloud Platform resources required for the ADK multi-agent system.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " CalmWork AI — Google Cloud Platform Setup Assistant" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Check gcloud CLI
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "ERROR: Google Cloud SDK ('gcloud') is not installed or not in PATH."
    Write-Host "Please install from: https://cloud.google.com/sdk/docs/install"
    exit 1
}

$PROJECT_ID = (gcloud config get-value project 2>$null).Trim()
if ([string]::IsNullOrWhiteSpace($PROJECT_ID) -or $PROJECT_ID -eq "(unset)") {
    $PROJECT_ID = Read-Host "Enter your GCP Project ID"
    gcloud config set project $PROJECT_ID
}

$REGION = if ($env:GCP_LOCATION) { $env:GCP_LOCATION } else { "us-central1" }
$SA_NAME = "calmwork-backend-sa"
$SA_EMAIL = "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
$BUCKET_NAME = "calmwork-${PROJECT_ID}-documents"

Write-Host "Using GCP Project: $PROJECT_ID" -ForegroundColor Green
Write-Host "Target Region:    $REGION" -ForegroundColor Green
Write-Host "Service Account:  $SA_EMAIL" -ForegroundColor Green
Write-Host "Documents Bucket: gs://$BUCKET_NAME" -ForegroundColor Green
Write-Host ""

# 2. Enable Required GCP APIs
Write-Host "Step 1/5: Enabling required Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable `
    run.googleapis.com `
    aiplatform.googleapis.com `
    dlp.googleapis.com `
    storage.googleapis.com `
    sqladmin.googleapis.com `
    secretmanager.googleapis.com `
    cloudbuild.googleapis.com

# 3. Create Service Account & Assign Least-Privilege IAM Roles
Write-Host "Step 2/5: Creating Service Account and configuring IAM roles..." -ForegroundColor Yellow
try {
    gcloud iam service-accounts describe $SA_EMAIL 2>$null
} catch {
    gcloud iam service-accounts create $SA_NAME --display-name="CalmWork Backend Service Account"
}

$ROLES = @(
    "roles/aiplatform.user",
    "roles/dlp.user",
    "roles/storage.objectAdmin",
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor"
)

foreach ($role in $ROLES) {
    Write-Host "  Granting $role..."
    gcloud projects add-iam-policy-binding $PROJECT_ID `
        --member="serviceAccount:$SA_EMAIL" `
        --role="$role" `
        --condition=None `
        --quiet 2>$null
}

# 4. Create Cloud Storage Bucket
Write-Host "Step 3/5: Provisioning Cloud Storage bucket..." -ForegroundColor Yellow
try {
    gcloud storage buckets describe "gs://${BUCKET_NAME}" 2>$null
} catch {
    gcloud storage buckets create "gs://${BUCKET_NAME}" --location=$REGION --uniform-bucket-level-access
}

# 5. Create Secret Manager Secret
Write-Host "Step 4/5: Configuring Secret Manager..." -ForegroundColor Yellow
try {
    gcloud secrets describe calmwork-jwt-secret 2>$null
} catch {
    $JWT_SECRET = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
    $tempFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tempFile, $JWT_SECRET)
    gcloud secrets create calmwork-jwt-secret --data-file=$tempFile
    Remove-Item -Path $tempFile -Force
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " GCP Setup Complete! All credits & APIs are ready." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "To build and deploy CalmWork to Cloud Run, execute:"
Write-Host ""
Write-Host "  cd backend"
Write-Host "  gcloud builds submit --tag gcr.io/${PROJECT_ID}/calmwork-backend:latest ."
Write-Host "  gcloud run deploy calmwork-backend \"
Write-Host "    --image gcr.io/${PROJECT_ID}/calmwork-backend:latest \"
Write-Host "    --region $REGION \"
Write-Host "    --platform managed \"
Write-Host "    --allow-unauthenticated \"
Write-Host "    --service-account $SA_EMAIL \"
Write-Host "    --set-env-vars GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=${REGION},USE_VERTEX_AI=true,GEMINI_MODEL=gemini-3.8-flash,USE_CLOUD_DLP_API=true,GCS_BUCKET_NAME=${BUCKET_NAME} \"
Write-Host "    --set-secrets SECRET_KEY=calmwork-jwt-secret:latest"
Write-Host "========================================================" -ForegroundColor Cyan
