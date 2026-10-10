"""
Cloud Storage Service for CalmWork AI Document Artifacts.
Provides persistent document storage in Google Cloud Storage (GCS)
with seamless fallback to local filesystem storage for local development.
"""

import os
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """
    Storage Service managing document uploads and artifacts.
    Supports Google Cloud Storage (GCS) and local disk fallback.
    """

    def __init__(self, bucket_name: Optional[str] = None, local_dir: str = "./uploads"):
        self.bucket_name = bucket_name or settings.GCS_BUCKET_NAME
        self.local_dir = local_dir
        self.use_gcs = bool(self.bucket_name and settings.GCP_PROJECT_ID)
        self._client = None

        if not os.path.exists(self.local_dir):
            os.makedirs(self.local_dir, exist_ok=True)

    def _get_gcs_client(self):
        if self._client is None and self.use_gcs:
            try:
                from google.cloud import storage
                self._client = storage.Client(project=settings.GCP_PROJECT_ID)
            except Exception as e:
                logger.warning(f"Could not initialize Google Cloud Storage client ({e}); using local storage.")
                self.use_gcs = False
        return self._client

    def upload_document(
        self,
        engagement_id: str,
        document_id: str,
        filename: str,
        content: str
    ) -> str:
        """
        Stores document content in GCS if available; otherwise writes to local storage directory.
        Returns document URI (gs://... or file://...).
        """
        destination_path = f"engagements/{engagement_id}/{document_id}/{filename}"

        if self.use_gcs:
            client = self._get_gcs_client()
            if client:
                try:
                    bucket = client.bucket(self.bucket_name)
                    blob = bucket.blob(destination_path)
                    blob.upload_from_string(content, content_type="text/plain")
                    uri = f"gs://{self.bucket_name}/{destination_path}"
                    logger.info(f"Stored document in GCS: {uri}")
                    return uri
                except Exception as e:
                    logger.warning(f"GCS upload failed ({e}); storing locally.")

        # Local storage fallback
        local_target_dir = os.path.join(self.local_dir, engagement_id, document_id)
        os.makedirs(local_target_dir, exist_ok=True)
        local_file_path = os.path.join(local_target_dir, filename)
        with open(local_file_path, "w", encoding="utf-8") as f:
            f.write(content)

        uri = f"file://{os.path.abspath(local_file_path)}"
        logger.info(f"Stored document locally: {uri}")
        return uri
