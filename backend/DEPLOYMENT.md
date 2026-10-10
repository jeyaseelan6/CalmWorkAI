# CalmWork AI — Google Cloud Production Deployment Guide

This guide describes how to deploy the CalmWork AI Google ADK multi-agent backend onto Google Cloud Platform using Cloud Run, Cloud SQL, Cloud Storage, and Vertex AI.

---

## 1. Prerequisites & Required Tools

1. **Google Cloud SDK (`gcloud` CLI)** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project [YOUR_PROJECT_ID]
   ```
2. **Required GCP APIs**:
   Enable the necessary services in your GCP project:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     aiplatform.googleapis.com \
     dlp.googleapis.com \
     storage.googleapis.com \
     sqladmin.googleapis.com \
     secretmanager.googleapis.com \
     cloudbuild.googleapis.com
   ```

---

## 2. IAM Service Account & Permissions

Create a dedicated service account for the Cloud Run backend service:

```bash
# 1. Create service account
gcloud iam service-accounts create calmwork-backend-sa \
  --display-name="CalmWork Backend Service Account"

# 2. Grant Vertex AI User (for ADK Gemini inference)
gcloud projects add-iam-policy-binding [YOUR_PROJECT_ID] \
  --member="serviceAccount:calmwork-backend-sa@[YOUR_PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 3. Grant Cloud DLP User (for pre-LLM PII de-identification)
gcloud projects add-iam-policy-binding [YOUR_PROJECT_ID] \
  --member="serviceAccount:calmwork-backend-sa@[YOUR_PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/dlp.user"

# 4. Grant Cloud Storage Object Admin (for document artifact storage)
gcloud projects add-iam-policy-binding [YOUR_PROJECT_ID] \
  --member="serviceAccount:calmwork-backend-sa@[YOUR_PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# 5. Grant Cloud SQL Client (for database connection)
gcloud projects add-iam-policy-binding [YOUR_PROJECT_ID] \
  --member="serviceAccount:calmwork-backend-sa@[YOUR_PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# 6. Grant Secret Manager Accessor (for credentials)
gcloud projects add-iam-policy-binding [YOUR_PROJECT_ID] \
  --member="serviceAccount:calmwork-backend-sa@[YOUR_PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Infrastructure Setup

### A. Cloud Storage Bucket (Document Artifacts)
```bash
gcloud storage buckets create gs://calmwork-[YOUR_PROJECT_ID]-documents \
  --location=us-central1 \
  --uniform-bucket-level-access
```

### B. Secret Manager (Security Keys)
```bash
# Create JWT Secret Key
echo -n "YOUR_STRONG_PRODUCTION_SECRET_KEY" | \
  gcloud secrets create calmwork-jwt-secret --data-file=-

# (Optional) Create Gemini API Key if not using Vertex AI ADC
echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets create calmwork-gemini-api-key --data-file=-
```

### C. Cloud SQL PostgreSQL (System of Record)
```bash
# Create Cloud SQL instance
gcloud sql instances create calmwork-pg-instance \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --storage-auto-increase

# Create database and user
gcloud sql databases create calmwork_db --instance=calmwork-pg-instance
gcloud sql users create calmwork_user --instance=calmwork-pg-instance --password="[STRONG_PASSWORD]"
```

---

## 4. Container Build & Cloud Run Deployment

Build and deploy the container image using Cloud Build:

```bash
cd backend

# Build image with Cloud Build
gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/calmwork-backend:latest .

# Deploy to Cloud Run
gcloud run deploy calmwork-backend \
  --image gcr.io/[YOUR_PROJECT_ID]/calmwork-backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --service-account calmwork-backend-sa@[YOUR_PROJECT_ID].iam.gserviceaccount.com \
  --add-cloudsql-instances [YOUR_PROJECT_ID]:us-central1:calmwork-pg-instance \
  --set-env-vars "\
GCP_PROJECT_ID=[YOUR_PROJECT_ID],\
GCP_LOCATION=us-central1,\
USE_VERTEX_AI=true,\
GEMINI_MODEL=gemini-3.8-flash,\
ADK_APP_NAME=calmwork-ai,\
ADK_SESSION_STORAGE=database,\
USE_CLOUD_DLP_API=true,\
GCS_BUCKET_NAME=calmwork-[YOUR_PROJECT_ID]-documents,\
DATABASE_URL=postgresql+asyncpg://calmwork_user:[STRONG_PASSWORD]@/calmwork_db?host=/cloudsql/[YOUR_PROJECT_ID]:us-central1:calmwork-pg-instance" \
  --set-secrets "\
SECRET_KEY=calmwork-jwt-secret:latest"
```

---

## 5. Summary of Cloud Resources & Manual Steps Checklist

| Resource / Setup Item | Requirement Status | Action Needed |
|---|---|---|
| **Google Cloud Project** | Mandatory | Set active project in `gcloud config set project`. |
| **GCP APIs Enabled** | Mandatory | Enable `run`, `aiplatform`, `dlp`, `storage`, `sqladmin`, `secretmanager`. |
| **Service Account & IAM** | Mandatory | Create `calmwork-backend-sa` and assign roles listed above. |
| **Cloud SQL Instance** | Mandatory (Prod) | Create PostgreSQL instance and run initial schema migrations. |
| **Cloud Storage Bucket** | Mandatory (Docs) | Create bucket `gs://calmwork-[PROJECT]-documents`. |
| **Secret Manager Secrets** | Mandatory (Security) | Store `calmwork-jwt-secret` (and optional `calmwork-gemini-api-key`). |
| **Vertex AI Quota** | Verification | Verify project has quota for `gemini-3.8-flash` in target region. |
