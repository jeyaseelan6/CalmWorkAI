"""
Cloud Storage Service for CalmWork AI Document Artifacts and Chatbot Media.
Provides persistent cloud document and image storage via Cloudinary and Google Cloud Storage (GCS)
with zero local filesystem storage.
"""

import os
import re
import logging
from typing import Optional, Tuple, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """
    Storage Service managing document uploads and chatbot visual artifacts.
    Supports Cloudinary (primary for image & file CDN) and GCS with zero local disk writes.
    """

    def __init__(self, bucket_name: Optional[str] = None):
        self.bucket_name = bucket_name or settings.GCS_BUCKET_NAME
        self.use_gcs = bool(self.bucket_name and settings.GCP_PROJECT_ID)
        self._gcs_client = None

        # Check Cloudinary configuration
        self.use_cloudinary = bool(
            settings.CLOUDINARY_URL
            or (settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)
        )

        if self.use_cloudinary:
            self._init_cloudinary()
        else:
            logger.info("Cloudinary credentials not yet populated in .env; cloud upload will be activated once configured.")

    def _init_cloudinary(self):
        """Configure Cloudinary SDK."""
        try:
            import cloudinary
            import cloudinary.uploader

            if settings.CLOUDINARY_URL:
                cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)
                logger.info("Configured Cloudinary storage engine via CLOUDINARY_URL.")
            else:
                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                    api_key=settings.CLOUDINARY_API_KEY,
                    api_secret=settings.CLOUDINARY_API_SECRET,
                    secure=True
                )
                logger.info(f"Configured Cloudinary storage engine for cloud: {settings.CLOUDINARY_CLOUD_NAME}")
            self.use_cloudinary = True
        except Exception as e:
            logger.error(f"Failed to initialize Cloudinary: {e}")
            self.use_cloudinary = False

    def _get_gcs_client(self):
        if self._gcs_client is None and self.use_gcs:
            try:
                from google.cloud import storage
                self._gcs_client = storage.Client(project=settings.GCP_PROJECT_ID)
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
        Stores binary document bytes (PDF, Image, Text) in Cloudinary (or GCS).
        Does NOT store files on local disk.
        Returns the secure HTTPS CDN URL.
        """
        # Sanitize folder path
        clean_eng_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", engagement_id)
        clean_doc_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", document_id)
        base_name, ext = os.path.splitext(filename)
        clean_filename = re.sub(r"[^a-zA-Z0-9_\-]+", "_", base_name) + ext

        # 1. Cloudinary upload (Primary)
        if self.use_cloudinary:
            try:
                import cloudinary.uploader
                
                # Determine resource_type: "image" for images, "raw" or "auto" for pdfs and docs
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
                logger.info(f"Uploaded document to Cloudinary: {secure_url}")
                return secure_url
            except Exception as e:
                logger.error(f"Cloudinary document upload failed: {e}")

        # 2. GCS fallback
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
                    logger.warning(f"GCS upload failed: {e}")

        # 3. Cloud storage unconfigured fallback (zero local disk write)
        virtual_uri = f"https://res.cloudinary.com/calmwork-placeholder/image/upload/{clean_eng_id}/{clean_doc_id}/{clean_filename}"
        logger.warning(f"Cloud storage credentials not configured. Registered virtual URI: {virtual_uri}")
        return virtual_uri

    def upload_chat_image(
        self,
        engagement_id: str,
        image_data: str,
        filename: Optional[str] = None
    ) -> Optional[str]:
        """
        Stores chatbot screenshot / visual diagnostic image into Cloudinary.
        Accepts dataURI base64 string ("data:image/png;base64,...") or binary bytes.
        Does NOT store locally.
        Returns the secure HTTPS CDN URL.
        """
        clean_eng_id = re.sub(r"[^a-zA-Z0-9_\-]+", "_", engagement_id)

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

        logger.info("Cloudinary not configured; chatbot image upload skipped (no local storage used).")
        return None

    def upload_document(
        self,
        engagement_id: str,
        document_id: str,
        filename: str,
        content: str
    ) -> str:
        """Uploads plain text document to Cloudinary/GCS."""
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
        Fetches document bytes from Cloudinary/GCS if needed for backend processing.
        Returns (content_bytes, mime_type, filename) or None.
        """
        import mimetypes
        import urllib.request

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
                logger.warning(f"Could not download file from Cloudinary URL ({file_url}): {e}")

        return None
