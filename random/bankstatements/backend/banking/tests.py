from unittest.mock import patch

from django.db import connection
from django.test import TestCase

from accounts.models import Organization

from . import tasks
from .models import BankAccount, Institution, PlaidItem


class PlaidItemEncryptionTests(TestCase):
    def test_access_token_is_encrypted_at_rest(self):
        """
        The raw database column must never contain the plaintext access
        token — only django_cryptography's encrypted ciphertext. This is the
        one secret this project persists, so it's worth pinning down.
        """
        org = Organization.objects.create(name="Acme LLC")
        institution = Institution.objects.create(plaid_institution_id="ins_1", name="Test Bank")
        plaintext = "access-sandbox-super-secret-value"
        item = PlaidItem.objects.create(
            organization=org,
            institution=institution,
            plaid_item_id="item-1",
            access_token=plaintext,
        )

        with connection.cursor() as cursor:
            cursor.execute("SELECT access_token FROM banking_plaiditem WHERE id = %s", [item.id])
            raw_value = cursor.fetchone()[0]

        self.assertNotIn(plaintext, str(raw_value))

        item.refresh_from_db()
        self.assertEqual(item.access_token, plaintext)


class SyncAccountsTaskTests(TestCase):
    def test_sync_item_accounts_creates_bank_accounts_from_plaid_response(self):
        org = Organization.objects.create(name="Acme LLC")
        institution = Institution.objects.create(plaid_institution_id="ins_1", name="Test Bank")
        item = PlaidItem.objects.create(
            organization=org, institution=institution, plaid_item_id="item-1", access_token="tok"
        )

        fake_accounts = [
            {
                "account_id": "acc-1",
                "name": "Business Checking",
                "mask": "1234",
                "type": "depository",
                "subtype": "checking",
            }
        ]
        with patch("banking.tasks.plaid_client.get_accounts", return_value=fake_accounts):
            tasks.sync_item_accounts(item.id)

        account = BankAccount.objects.get(plaid_account_id="acc-1")
        self.assertEqual(account.name, "Business Checking")
        self.assertEqual(account.mask, "1234")
        self.assertEqual(account.plaid_item_id, item.id)


class WebhookVerificationTests(TestCase):
    def test_verify_webhook_rejects_missing_jwt(self):
        from . import plaid_client

        self.assertFalse(plaid_client.verify_webhook(b"{}", None))
        self.assertFalse(plaid_client.verify_webhook(b"{}", ""))

    def test_verify_webhook_rejects_malformed_jwt(self):
        from . import plaid_client

        self.assertFalse(plaid_client.verify_webhook(b"{}", "not-a-jwt"))
