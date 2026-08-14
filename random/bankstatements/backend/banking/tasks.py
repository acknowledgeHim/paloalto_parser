import logging

from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone

from . import plaid_client
from .models import BankAccount, PlaidItem

logger = logging.getLogger(__name__)


@shared_task
def sync_all_items():
    """Periodic entry point (wire up via django-celery-beat, e.g. every 6h)."""
    for item_id in PlaidItem.objects.filter(status=PlaidItem.Status.ACTIVE).values_list(
        "id", flat=True
    ):
        sync_item_statements.delay(item_id)


@shared_task
def sync_item_statements(plaid_item_id: int):
    """Pull any statements Plaid has newly made available for one item."""
    from documents.models import Statement  # local import avoids app-loading order issues

    try:
        item = PlaidItem.objects.get(id=plaid_item_id)
    except PlaidItem.DoesNotExist:
        logger.warning("sync_item_statements: PlaidItem %s no longer exists", plaid_item_id)
        return

    try:
        available = plaid_client.list_available_statements(item.access_token)
    except Exception:
        logger.exception("Failed listing statements for PlaidItem %s", plaid_item_id)
        item.status = PlaidItem.Status.ERROR
        item.save(update_fields=["status"])
        return

    for entry in available:
        if Statement.objects.filter(plaid_statement_id=entry["statement_id"]).exists():
            continue
        try:
            account = BankAccount.objects.get(plaid_account_id=entry["account_id"])
        except BankAccount.DoesNotExist:
            logger.warning("Statement for unknown account %s — run account sync first", entry["account_id"])
            continue

        pdf_bytes = plaid_client.download_statement_pdf(item.access_token, entry["statement_id"])
        statement = Statement(
            account=account,
            plaid_statement_id=entry["statement_id"],
            period_start=entry["start_date"],
            period_end=entry["end_date"],
        )
        statement.file.save(
            f"{account.plaid_account_id}_{entry['statement_id']}.pdf",
            ContentFile(pdf_bytes),
            save=True,
        )

    item.last_synced_at = timezone.now()
    item.status = PlaidItem.Status.ACTIVE
    item.save(update_fields=["last_synced_at", "status"])


@shared_task
def sync_item_accounts(plaid_item_id: int):
    """Refresh the BankAccount rows for an item right after Link exchange."""
    item = PlaidItem.objects.get(id=plaid_item_id)
    for account in plaid_client.get_accounts(item.access_token):
        BankAccount.objects.update_or_create(
            plaid_account_id=account["account_id"],
            defaults={
                "plaid_item": item,
                "name": account["name"],
                "mask": account.get("mask") or "",
                "account_type": str(account.get("type", "")),
                "account_subtype": str(account.get("subtype", "")),
            },
        )
