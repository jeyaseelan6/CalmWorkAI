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

    def upload_binary_file(
        self,
        engagement_id: str,
        document_id: str,
        filename: str,
        file_bytes: bytes,
        content_type: str = "application/octet-stream"
    ) -> str:
        """
        Stores binary document bytes (PDF, Image, text) in GCS or local disk.
        """
        destination_path = f"engagements/{engagement_id}/{document_id}/{filename}"

        if self.use_gcs:
            client = self._get_gcs_client()
            if client:
                try:
                    bucket = client.bucket(self.bucket_name)
                    blob = bucket.blob(destination_path)
                    blob.upload_from_string(file_bytes, content_type=content_type)
                    uri = f"gs://{self.bucket_name}/{destination_path}"
                    logger.info(f"Stored binary artifact in GCS: {uri}")
                    return uri
                except Exception as e:
                    logger.warning(f"GCS binary upload failed ({e}); falling back to local storage.")

        local_target_dir = os.path.join(self.local_dir, engagement_id, document_id)
        os.makedirs(local_target_dir, exist_ok=True)
        local_file_path = os.path.join(local_target_dir, filename)
        with open(local_file_path, "wb") as f:
            f.write(file_bytes)

        uri = f"file://{os.path.abspath(local_file_path)}"
        logger.info(f"Stored binary artifact locally: {uri}")
        return uri

    def get_document_file(
        self,
        engagement_id: str,
        document_id: str,
        filename: Optional[str] = None
    ) -> Optional[tuple[bytes, str, str]]:
        """
        Retrieves file bytes, MIME type, and filename from local storage or GCS.
        Returns (bytes, content_type, filename) or None.
        """
        import mimetypes

        local_target_dir = os.path.join(self.local_dir, engagement_id, document_id)
        if os.path.exists(local_target_dir):
            files = [f for f in os.listdir(local_target_dir) if os.path.isfile(os.path.join(local_target_dir, f))]
            target_file = filename if filename and filename in files else (files[0] if files else None)
            if target_file:
                file_path = os.path.join(local_target_dir, target_file)
                with open(file_path, "rb") as f:
                    content_bytes = f.read()
                mime_type, _ = mimetypes.guess_type(target_file)
                return content_bytes, mime_type or "application/octet-stream", target_file

        if self.use_gcs and self._get_gcs_client():
            client = self._get_gcs_client()
            prefix = f"engagements/{engagement_id}/{document_id}/"
            try:
                bucket = client.bucket(self.bucket_name)
                blobs = list(bucket.list_blobs(prefix=prefix, max_results=1))
                if blobs:
                    blob = blobs[0]
                    content_bytes = blob.download_as_bytes()
                    blob_filename = os.path.basename(blob.name)
                    mime_type, _ = mimetypes.guess_type(blob_filename)
                    return content_bytes, mime_type or blob.content_type or "application/octet-stream", blob_filename
            except Exception as e:
                logger.warning(f"Error fetching from GCS: {e}")

        return None

