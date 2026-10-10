#!/usr/bin/env bash
# ==============================================================================
# CalmWork AI — GCP Setup & Credit Activation Automation Script
# Sets up all Google Cloud Platform resources required for the ADK multi-agent system.
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo " CalmWork AI — Google Cloud Platform Setup Assistant"
echo "========================================================"

# 1. Check gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "ERROR: Google Cloud SDK ('gcloud') is not installed or not in PATH."
    echo "Please install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    read -rp "Enter your GCP Project ID: " PROJECT_ID
    gcloud config set project "$PROJECT_ID"
fi

REGION="${GCP_LOCATION:-us-central1}"
SA_NAME="calmwork-backend-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="calmwork-${PROJECT_ID}-documents"

echo "Using GCP Project: $PROJECT_ID"
echo "Target Region:    $REGION"
echo "Service Account:  $SA_EMAIL"
echo "Documents Bucket: gs://$BUCKET_NAME"
echo ""

# 2. Enable Required GCP APIs
echo "Step 1/5: Enabling required Google Cloud APIs..."
gcloud services enable \
    run.googleapis.com \
    aiplatform.googleapis.com \
    dlp.googleapis.com \
    storage.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com

# 3. Create Service Account & Assign Least-Privilege IAM Roles
echo "Step 2/5: Creating Service Account and configuring IAM roles..."
if ! gcloud iam service-accounts describe "$SA_EMAIL" &>/dev/null; then
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="CalmWork Backend Service Account"
fi

ROLES=(
    "roles/aiplatform.user"
    "roles/dlp.user"
    "roles/storage.objectAdmin"
    "roles/cloudsql.client"
    "roles/secretmanager.secretAccessor"
)

for role in "${ROLES[@]}"; do
    echo "  Granting $role..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$role" \
        --condition=None \
        --quiet &>/dev/null
done

# 4. Create Cloud Storage Bucket
echo "Step 3/5: Provisioning Cloud Storage bucket..."
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" &>/dev/null; then
    gcloud storage buckets create "gs://${BUCKET_NAME}" \
        --location="$REGION" \
        --uniform-bucket-level-access
fi

# 5. Create Secret Manager Secret
echo "Step 4/5: Configuring Secret Manager..."
if ! gcloud secrets describe calmwork-jwt-secret &>/dev/null; then
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    echo -n "$JWT_SECRET" | gcloud secrets create calmwork-jwt-secret --data-file=-
fi

echo ""
echo "========================================================"
echo " GCP Setup Complete! All credits & APIs are ready."
echo "========================================================"
echo "To build and deploy CalmWork to Cloud Run, execute:"
echo ""
echo "  cd backend"
echo "  gcloud builds submit --tag gcr.io/${PROJECT_ID}/calmwork-backend:latest ."
echo "  gcloud run deploy calmwork-backend \\"
echo "    --image gcr.io/${PROJECT_ID}/calmwork-backend:latest \\"
echo "    --region $REGION \\"
echo "    --platform managed \\"
echo "    --allow-unauthenticated \\"
echo "    --service-account $SA_EMAIL \\"
echo "    --set-env-vars GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=${REGION},USE_VERTEX_AI=true,GEMINI_MODEL=gemini-3.8-flash,USE_CLOUD_DLP_API=true,GCS_BUCKET_NAME=${BUCKET_NAME} \\"
echo "    --set-secrets SECRET_KEY=calmwork-jwt-secret:latest"
echo "========================================================"
