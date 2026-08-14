from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase

from accounts.models import Membership, Organization, User
from banking.models import BankAccount, Institution, PlaidItem
from documents.models import CheckImageUpload


class ApiTestCase(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Acme LLC")
        self.member = User.objects.create_user(
            username="member", email="member@example.com", password="x"
        )
        Membership.objects.create(user=self.member, organization=self.org, role=Membership.Role.OWNER)

        self.outsider = User.objects.create_user(
            username="outsider", email="outsider@example.com", password="x"
        )

        self.institution = Institution.objects.create(plaid_institution_id="ins_1", name="Test Bank")
        self.plaid_item = PlaidItem.objects.create(
            organization=self.org,
            institution=self.institution,
            plaid_item_id="item-1",
            access_token="tok",
        )
        self.account = BankAccount.objects.create(
            plaid_item=self.plaid_item, plaid_account_id="acc-1", name="Checking", mask="1234"
        )

        self.member_client = APIClient()
        self.member_client.force_authenticate(user=self.member)

        self.outsider_client = APIClient()
        self.outsider_client.force_authenticate(user=self.outsider)


class OrganizationViewSetTests(ApiTestCase):
    def test_member_sees_their_organization_with_role(self):
        response = self.member_client.get("/api/organizations/")
        self.assertEqual(response.status_code, 200)
        results = response.data if isinstance(response.data, list) else response.data["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], self.org.id)
        self.assertEqual(results[0]["role"], "owner")

    def test_outsider_sees_no_organizations(self):
        response = self.outsider_client.get("/api/organizations/")
        self.assertEqual(response.status_code, 200)
        results = response.data if isinstance(response.data, list) else response.data["results"]
        self.assertEqual(len(results), 0)


class LinkTokenViewTests(ApiTestCase):
    @patch("api.views.plaid_client.create_link_token", return_value="link-sandbox-token")
    def test_member_can_create_link_token(self, mock_create):
        response = self.member_client.post(
            "/api/plaid/link-token/", {"organization_id": self.org.id}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["link_token"], "link-sandbox-token")
        mock_create.assert_called_once()

    def test_outsider_cannot_create_link_token_for_someone_elses_org(self):
        response = self.outsider_client.post(
            "/api/plaid/link-token/", {"organization_id": self.org.id}
        )
        self.assertEqual(response.status_code, 403)


class ExchangePublicTokenViewTests(ApiTestCase):
    @patch("api.views.sync_item_statements")
    @patch("api.views.sync_item_accounts")
    @patch(
        "api.views.plaid_client.exchange_public_token",
        return_value={"access_token": "new-token", "item_id": "item-new"},
    )
    def test_exchange_creates_plaid_item_and_triggers_sync(
        self, mock_exchange, mock_sync_accounts, mock_sync_statements
    ):
        response = self.member_client.post(
            "/api/plaid/exchange/",
            {
                "organization_id": self.org.id,
                "public_token": "public-sandbox-token",
                "institution_id": "ins_2",
                "institution_name": "Another Bank",
            },
        )
        self.assertEqual(response.status_code, 201)
        item = PlaidItem.objects.get(plaid_item_id="item-new")
        self.assertEqual(item.organization, self.org)
        self.assertEqual(item.institution.name, "Another Bank")
        mock_sync_accounts.delay.assert_called_once_with(item.id)
        mock_sync_statements.delay.assert_called_once_with(item.id)


class BankAccountViewSetTests(ApiTestCase):
    def test_member_lists_accounts_for_their_org(self):
        response = self.member_client.get("/api/accounts/", {"organization_id": self.org.id})
        self.assertEqual(response.status_code, 200)
        results = response.data if isinstance(response.data, list) else response.data["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], self.account.id)

    def test_outsider_forbidden(self):
        response = self.outsider_client.get("/api/accounts/", {"organization_id": self.org.id})
        self.assertEqual(response.status_code, 403)


class CheckImageUploadViewSetTests(ApiTestCase):
    def test_member_can_upload_check_image(self):
        fake_file = SimpleUploadedFile(
            "check.jpg", b"\xff\xd8\xff" + b"fake-jpeg-bytes", content_type="image/jpeg"
        )
        response = self.member_client.post(
            "/api/check-images/",
            {"account": self.account.id, "file": fake_file, "note": "March deposit"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        upload = CheckImageUpload.objects.get(id=response.data["id"])
        # uploaded_by is server-set from the authenticated user, never client-supplied.
        self.assertEqual(upload.uploaded_by, self.member)
        self.assertEqual(upload.account, self.account)

    def test_outsider_cannot_upload_to_someone_elses_account(self):
        fake_file = SimpleUploadedFile(
            "check.jpg", b"\xff\xd8\xff" + b"fake-jpeg-bytes", content_type="image/jpeg"
        )
        response = self.outsider_client.post(
            "/api/check-images/",
            {"account": self.account.id, "file": fake_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(CheckImageUpload.objects.exists())

    def test_upload_is_rejected_when_content_does_not_match_an_allowed_file_type(self):
        # Named and content-typed as an image, but the actual bytes are HTML —
        # this is exactly the spoofing the magic-byte check exists to catch.
        malicious_file = SimpleUploadedFile(
            "check.jpg",
            b"<script>alert(document.cookie)</script>",
            content_type="image/jpeg",
        )
        response = self.member_client.post(
            "/api/check-images/",
            {"account": self.account.id, "file": malicious_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(CheckImageUpload.objects.exists())


class PlaidWebhookViewTests(ApiTestCase):
    def test_unverified_webhook_is_rejected(self):
        with patch("api.views.plaid_client.verify_webhook", return_value=False):
            response = self.client.post(
                "/api/webhooks/plaid/",
                data='{"webhook_type": "STATEMENTS", "webhook_code": "READY", "item_id": "item-1"}',
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 400)

    @patch("api.views.sync_item_statements")
    def test_verified_statements_webhook_triggers_sync(self, mock_sync_statements):
        with patch("api.views.plaid_client.verify_webhook", return_value=True):
            response = self.client.post(
                "/api/webhooks/plaid/",
                data='{"webhook_type": "STATEMENTS", "webhook_code": "READY", "item_id": "item-1"}',
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        mock_sync_statements.delay.assert_called_once_with(self.plaid_item.id)
