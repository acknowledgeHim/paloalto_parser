from django.db import models
from django_cryptography.fields import encrypt

from accounts.models import Organization


class Institution(models.Model):
    """A bank or credit union, as identified by Plaid."""

    plaid_institution_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    logo_url = models.URLField(blank=True)

    def __str__(self):
        return self.name


class PlaidItem(models.Model):
    """
    One Plaid "Item" = one successful Link session for one organization at one
    institution.

    `access_token` is the ONLY secret this project ever stores — it is a
    Plaid-issued token scoped to read-only account access, not a bank
    username/password. It is encrypted at rest via django-cryptography using
    settings.FIELD_ENCRYPTION_KEY.
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        LOGIN_REQUIRED = "login_required", "Re-authentication required"
        ERROR = "error", "Error"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="plaid_items"
    )
    institution = models.ForeignKey(Institution, on_delete=models.PROTECT)
    plaid_item_id = models.CharField(max_length=64, unique=True)
    access_token = encrypt(models.CharField(max_length=255))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.institution} — {self.organization}"


class BankAccount(models.Model):
    plaid_item = models.ForeignKey(PlaidItem, on_delete=models.CASCADE, related_name="accounts")
    plaid_account_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    mask = models.CharField(max_length=8, blank=True)
    account_type = models.CharField(max_length=32, blank=True)
    account_subtype = models.CharField(max_length=32, blank=True)

    def __str__(self):
        return f"{self.name} ({self.mask})"
