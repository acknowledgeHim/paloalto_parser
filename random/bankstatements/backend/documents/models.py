from django.core.validators import FileExtensionValidator
from django.db import models

from accounts.models import User
from banking.models import BankAccount

# Extension allowlist — defense-in-depth alongside the magic-byte check in
# api/serializers.CheckImageUploadSerializer.validate_file(), which is what
# actually stops content-type spoofing for API uploads. This also covers
# uploads made directly through Django admin, which don't go through that
# serializer.
_ALLOWED_CHECK_IMAGE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"]


def statement_upload_path(instance, filename):
    return f"statements/{instance.account.plaid_item.organization_id}/{filename}"


def check_image_upload_path(instance, filename):
    return f"check_images/{instance.account.plaid_item.organization_id}/{filename}"


class Statement(models.Model):
    """A PDF statement pulled automatically from Plaid — never uploaded by hand."""

    account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name="statements")
    plaid_statement_id = models.CharField(max_length=64, unique=True)
    period_start = models.DateField()
    period_end = models.DateField()
    file = models.FileField(upload_to=statement_upload_path)
    synced_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-period_end"]

    def __str__(self):
        return f"{self.account} statement {self.period_start}–{self.period_end}"


class CheckImageUpload(models.Model):
    """
    A check image/PDF added by a human who logged into their own bank portal
    and downloaded it themselves.

    This is intentionally the ONLY path check images enter the system through
    — see project README for why automated retrieval isn't offered.
    """

    account = models.ForeignKey(
        BankAccount, on_delete=models.CASCADE, related_name="check_images"
    )
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    file = models.FileField(
        upload_to=check_image_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=_ALLOWED_CHECK_IMAGE_EXTENSIONS)],
    )
    check_date = models.DateField(null=True, blank=True)
    note = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.account} check image ({self.uploaded_at:%Y-%m-%d})"
