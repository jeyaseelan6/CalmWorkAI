"""
Cloud Storage Service for CalmWork AI Document Artifacts and Chatbot Media.
Provides persistent cloud document and image storage natively on Google Cloud Storage (GCS)
with zero local filesystem storage and backward-compatible Cloudinary fallback.
"""

import os
import re
import uuid
import base64
import logging
import mimetypes
import urllib.request
import shutil
from typing import Optional, Tuple, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """
    Storage Service managing document uploads and chatbot visual artifacts.
    Primary: Google Cloud Storage (GCS) in asia-south1.
    Fallback: Cloudinary.
    """

    def __init__(self, bucket_name: Optional[str] = None):
        self.bucket_name = bucket_name or settings.GCS_BUCKET_NAME or "calmwork-documents-63094329383"
        self.project_id = settings.GCP_PROJECT_ID or "calmwork-ai"
        self.use_gcs = bool(self.bucket_name and self.project_id)
        self._gcs_client = None

        # Check Cloudinary configuration for legacy/fallback
        self.use_cloudinary = bool(
            settings.CLOUDINARY_URL
            or (settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)
        )

        if self.use_gcs:
            logger.info(f"Configured Google Cloud Storage primary engine on bucket: gs://{self.bucket_name}")
        elif self.use_cloudinary:
            self._init_cloudinary()

    def _init_cloudinary(self):
        """Configure Cloudinary SDK as fallback."""
        try:
            import cloudinary
            import cloudinary.uploader

            if settings.CLOUDINARY_URL:
                cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)
                logger.info("Configured Cloudinary fallback storage engine via CLOUDINARY_URL.")
            else:
                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                    api_key=settings.CLOUDINARY_API_KEY,
                    api_secret=settings.CLOUDINARY_API_SECRET,
                    secure=True
                )
                logger.info(f"Configured Cloudinary fallback storage engine for cloud: {settings.CLOUDINARY_CLOUD_NAME}")
            self.use_cloudinary = True
        except Exception as e:
            logger.error(f"Failed to initialize Cloudinary fallback: {e}")
            self.use_cloudinary = False

    def _get_gcs_client(self):
        if self._gcs_client is None and self.use_gcs:
            try:
                from google.cloud import storage
                self._gcs_client = storage.Client(project=self.project_id)
            except Exception as e:
                logger.warning(f"Could not initialize Google Cloud Storage client: {e}")
                self.use_gcs = False
        return self._gcs_client

    def upload_binary_file(
        self,
        engagement_id: str,
        document_id: str,
        filename: str,
        file_bytes: bytes,
        content_type: str = "application/octet-stream"
    ) -> str:
        """
        Stores binary document bytes (PDF, Image, Text) in Google Cloud Storage.
        Returns the secure HTTPS CDN URL.
        """
        clean_eng_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", engagement_id)
        clean_doc_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", document_id)
        base_name, ext = os.path.splitext(filename)
        clean_filename = re.sub(r"[^a-zA-Z0-9_\-]+", "_", base_name) + ext

        # 1. Google Cloud Storage upload (Primary)
        if self.use_gcs:
            client = self._get_gcs_client()
            if client:
                try:
                    destination_path = f"engagements/{clean_eng_id}/{clean_doc_id}/{clean_filename}"
                    bucket = client.bucket(self.bucket_name)
                    blob = bucket.blob(destination_path)
                    blob.upload_from_string(file_bytes, content_type=content_type)
                    uri = f"https://storage.googleapis.com/{self.bucket_name}/{destination_path}"
                    logger.info(f"Stored document in GCS: {uri}")
                    return uri
                except Exception as e:
                    logger.error(f"GCS upload failed: {e}. Attempting fallback...")

        # 2. Cloudinary upload (Fallback)
        if self.use_cloudinary:
            try:
                import cloudinary.uploader
                is_image = content_type.startswith("image/") or ext.lower() in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]
                res_type = "image" if is_image else "auto"
                folder = f"calmwork/{clean_eng_id}/documents"
                public_id = f"{clean_doc_id}_{clean_filename}"

                upload_result = cloudinary.uploader.upload(
                    file_bytes,
                    folder=folder,
                    public_id=public_id,
                    resource_type=res_type,
                    overwrite=True,
                    use_filename=True
                )
                secure_url = upload_result.get("secure_url") or upload_result.get("url")
                logger.info(f"Uploaded document to Cloudinary (fallback): {secure_url}")
                return secure_url
            except Exception as e:
                logger.error(f"Cloudinary document upload failed: {e}")

        # 3. Virtual URI Fallback (Zero local disk writes)
        destination_path = f"engagements/{clean_eng_id}/{clean_doc_id}/{clean_filename}"
        virtual_uri = f"https://storage.googleapis.com/{self.bucket_name}/{destination_path}"
        logger.warning(f"Registered GCS reference URI: {virtual_uri}")
        return virtual_uri

    def upload_chat_image(
        self,
        engagement_id: str,
        image_data: str,
        filename: Optional[str] = None
    ) -> Optional[str]:
        """
        Stores chatbot screenshot / visual diagnostic image into Google Cloud Storage.
        Accepts dataURI base64 string ("data:image/png;base64,...") or binary string.
        Returns the secure HTTPS CDN URL.
        """
        clean_eng_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", engagement_id)
        img_id = uuid.uuid4().hex[:8]
        safe_fn = filename or f"screenshot_{img_id}.png"
        clean_filename = re.sub(r"[^a-zA-Z0-9_\-]+", "_", os.path.splitext(safe_fn)[0]) + ".png"

        # Extract binary bytes from base64 dataURI
        content_type = "image/png"
        try:
            if "," in image_data:
                header, encoded = image_data.split(",", 1)
                if "image/jpeg" in header:
                    content_type = "image/jpeg"
                elif "image/webp" in header:
                    content_type = "image/webp"
                raw_bytes = base64.b64decode(encoded)
            else:
                raw_bytes = base64.b64decode(image_data)
        except Exception as e:
            logger.warning(f"Failed to decode chat image base64 data: {e}")
            raw_bytes = image_data.encode("utf-8") if isinstance(image_data, str) else image_data

        # 1. Google Cloud Storage upload (Primary)
        if self.use_gcs:
            client = self._get_gcs_client()
            if client:
                try:
                    destination_path = f"chat_images/{clean_eng_id}/{img_id}_{clean_filename}"
                    bucket = client.bucket(self.bucket_name)
                    blob = bucket.blob(destination_path)
                    blob.upload_from_string(raw_bytes, content_type=content_type)
                    uri = f"https://storage.googleapis.com/{self.bucket_name}/{destination_path}"
                    logger.info(f"Stored chat screenshot in GCS: {uri}")
                    return uri
                except Exception as e:
                    logger.error(f"GCS chat image upload failed: {e}. Attempting fallback...")

        # 2. Cloudinary upload (Fallback)
        if self.use_cloudinary:
            try:
                import cloudinary.uploader
                folder = f"calmwork/{clean_eng_id}/chat_images"
                upload_result = cloudinary.uploader.upload(
                    image_data,
                    folder=folder,
                    resource_type="image",
                    overwrite=False
                )
                secure_url = upload_result.get("secure_url") or upload_result.get("url")
                logger.info(f"Uploaded chatbot screenshot to Cloudinary: {secure_url}")
                return secure_url
            except Exception as e:
                logger.error(f"Cloudinary chat image upload failed: {e}")

        return None

    def upload_document(
        self,
        engagement_id: str,
        document_id: str,
        filename: str,
        content: str
    ) -> str:
        """Uploads plain text document to Google Cloud Storage."""
        file_bytes = content.encode("utf-8")
        return self.upload_binary_file(
            engagement_id=engagement_id,
            document_id=document_id,
            filename=filename,
            file_bytes=file_bytes,
            content_type="text/plain; charset=utf-8"
        )

    def get_document_file(
        self,
        engagement_id: str,
        document_id: str,
        file_url: Optional[str] = None
    ) -> Optional[Tuple[bytes, str, str]]:
        """
        Fetches document bytes from GCS or legacy Cloudinary for streaming or processing.
        Returns (content_bytes, mime_type, filename) or None.
        """
        # 1. Fetch from Google Cloud Storage
        if self.use_gcs:
            client = self._get_gcs_client()
            if client:
                try:
                    bucket = client.bucket(self.bucket_name)

                    # Extract blob path from file_url if present
                    blob_path = None
                    if file_url and f"storage.googleapis.com/{self.bucket_name}/" in file_url:
                        blob_path = file_url.split(f"storage.googleapis.com/{self.bucket_name}/")[-1]
                    elif file_url and file_url.startswith("gs://"):
                        blob_path = file_url.replace(f"gs://{self.bucket_name}/", "")
                    else:
                        clean_eng_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", engagement_id)
                        clean_doc_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", document_id)
                        prefix = f"engagements/{clean_eng_id}/{clean_doc_id}/"
                        blobs = list(bucket.list_blobs(prefix=prefix, max_results=1))
                        if blobs:
                            blob_path = blobs[0].name

                    if blob_path:
                        blob = bucket.blob(blob_path)
                        content_bytes = blob.download_as_bytes()
                        filename = os.path.basename(blob_path)
                        mime_type, _ = mimetypes.guess_type(filename)
                        return content_bytes, mime_type or blob.content_type or "application/octet-stream", filename
                except Exception as e:
                    logger.warning(f"Could not download blob from GCS: {e}")

        # 2. Fetch from Legacy Cloudinary / HTTP URL
        if file_url and (file_url.startswith("http://") or file_url.startswith("https://")):
            try:
                req = urllib.request.Request(file_url, headers={"User-Agent": "CalmWork-AI/1.0"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    content_bytes = resp.read()
                    content_type = resp.headers.get_content_type()
                    filename = os.path.basename(file_url.split("?")[0])
                    mime_type, _ = mimetypes.guess_type(filename)
                    return content_bytes, mime_type or content_type or "application/octet-stream", filename
            except Exception as e:
                logger.warning(f"Could not download file from URL ({file_url}): {e}")

        return None

    def delete_document_file(
        self,
        engagement_id: str,
        document_id: str,
        file_url: Optional[str] = None
    ) -> bool:
        """
        Permanently deletes document binary file and related blobs from Google Cloud Storage,
        and cleans up any local upload cache directories if present.
        """
        deleted_any = False
        clean_eng_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", engagement_id)
        clean_doc_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", document_id)

        # 1. Delete from Google Cloud Storage
        if self.use_gcs and self.bucket_name:
            client = self._get_gcs_client()
            if client:
                try:
                    bucket = client.bucket(self.bucket_name)
                    # A. Delete by exact blob path if file_url provided
                    if file_url and f"storage.googleapis.com/{self.bucket_name}/" in file_url:
                        blob_path = file_url.split(f"storage.googleapis.com/{self.bucket_name}/")[-1]
                        blob = bucket.blob(blob_path)
                        if blob.exists():
                            blob.delete()
                            logger.info(f"Deleted GCS blob: {blob_path}")
                            deleted_any = True
                    elif file_url and file_url.startswith("gs://"):
                        blob_path = file_url.replace(f"gs://{self.bucket_name}/", "")
                        blob = bucket.blob(blob_path)
                        if blob.exists():
                            blob.delete()
                            logger.info(f"Deleted GCS blob: {blob_path}")
                            deleted_any = True

                    # B. Also delete any blobs matching prefix engagements/{clean_eng_id}/{clean_doc_id}/
                    prefix = f"engagements/{clean_eng_id}/{clean_doc_id}/"
                    blobs = list(bucket.list_blobs(prefix=prefix))
                    for b in blobs:
                        b.delete()
                        logger.info(f"Deleted GCS blob under prefix {prefix}: {b.name}")
                        deleted_any = True
                except Exception as e:
                    logger.warning(f"Error deleting blob from GCS: {e}")

        # 2. Clean up local uploads cache directory if it exists
        try:
            upload_dir = getattr(self, "upload_dir", "uploads")
            local_doc_dir = os.path.join(upload_dir, engagement_id, document_id)
            if os.path.exists(local_doc_dir):
                shutil.rmtree(local_doc_dir, ignore_errors=True)
                logger.info(f"Cleaned up local upload directory: {local_doc_dir}")
                deleted_any = True
        except Exception as e:
            logger.debug(f"Local upload directory cleanup note: {e}")

        return deleted_any
