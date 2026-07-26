"""Local photo storage service.

Writes uploaded images to a configurable directory and returns URLs
served by the StaticFiles mount at ``/uploads``.
"""

import asyncio
import uuid
from pathlib import Path

from app.config import get_settings

ALLOWED_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
MAX_PHOTOS_PER_TOOL = 5

_CONTENT_TYPE_TO_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

# Magic-byte signatures for the supported image formats. The first 4–12
# bytes of every well-formed image file start with one of these patterns.
# We only need enough bytes to disambiguate the format — the file body
# itself is not parsed.
_MAGIC_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    # WebP: "RIFF....WEBP"
    (b"RIFF", "image/webp"),  # verified by 8-byte offset check below
]


def _detect_content_type(content: bytes) -> str | None:
    """Return the canonical MIME type for *content* based on magic bytes, or None."""
    if not content:
        return None
    head = content[:16]
    for signature, mime in _MAGIC_SIGNATURES:
        if head.startswith(signature):
            if mime == "image/webp":
                # RIFF/WEBP needs the 8-byte offset check.
                if len(content) >= 12 and content[8:12] == b"WEBP":
                    return mime
                continue
            return mime
    return None


class PhotoStorageService:
    """Manages tool photo uploads to local disk."""

    def __init__(self, upload_dir: Path | None = None) -> None:
        self.upload_dir = upload_dir or get_settings().media_dir / "tool_photos"
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def validate_image(
        content_type: str | None,
        file_size: int,
        content: bytes | None = None,
    ) -> None:
        """Raise ValidationError if the uploaded file is not an acceptable image.

        Validation is two-stage:
          1. The client-supplied ``Content-Type`` header is checked first as a
             quick filter (it's still consulted, but no longer trusted).
          2. If the raw bytes are available, the magic-byte signature is
             compared against the declared type. Mismatch → reject.
        """
        from app.core.exceptions import ValidationError

        settings = get_settings()

        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValidationError(
                f"Unsupported file type: {content_type}. Allowed: JPEG, PNG, WebP, GIF."
            )
        if file_size > settings.max_upload_size_bytes:
            max_mb = settings.max_upload_size_bytes / (1024 * 1024)
            raise ValidationError(
                f"File too large ({file_size} bytes). Maximum is {max_mb:.0f} MB."
            )
        if content is not None:
            detected = _detect_content_type(content)
            if detected is None:
                raise ValidationError(
                    "File contents do not match any supported image format. "
                    "Allowed: JPEG, PNG, WebP, GIF."
                )
            if detected != content_type:
                raise ValidationError(
                    f"File contents look like {detected} but the upload was "
                    f"declared as {content_type}. Rejected as a possible "
                    "content-type spoofing attempt."
                )

    async def save(self, content: bytes, content_type: str) -> str:
        """Persist an uploaded photo and return its public URL path.

        Returns a path like ``/uploads/<uuid>.jpg``.
        The disk write is offloaded to a thread pool to avoid blocking
        the async event loop.
        """
        suffix = _CONTENT_TYPE_TO_EXT.get(content_type, ".bin")
        filename = f"{uuid.uuid4()}{suffix}"
        filepath = self.upload_dir / filename
        await asyncio.to_thread(filepath.write_bytes, content)
        return f"/uploads/{filename}"

    def delete(self, url: str) -> None:
        """Remove a previously saved photo file if it still exists.

        Defensive against path-traversal: rejects anything that doesn't live
        directly inside ``upload_dir``.
        """
        if not url.startswith("/uploads/"):
            return
        filename = url.split("/uploads/", 1)[1]
        # Reject path-traversal payloads like "../../etc/passwd".
        if ".." in filename or "/" in filename or "\\" in filename:
            return
        filepath = (self.upload_dir / filename).resolve()
        try:
            filepath.relative_to(self.upload_dir.resolve())
        except ValueError:
            return
        if filepath.exists():
            filepath.unlink()
