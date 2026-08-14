import json
import logging

from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Organization
from banking import plaid_client
from banking.models import BankAccount, Institution, PlaidItem
from banking.tasks import sync_item_accounts, sync_item_statements
from documents.models import CheckImageUpload, Statement

from .permissions import require_membership
from .serializers import (
    BankAccountSerializer,
    CheckImageUploadSerializer,
    LinkTokenRequestSerializer,
    OrganizationSerializer,
    PublicTokenExchangeSerializer,
    StatementSerializer,
)

logger = logging.getLogger(__name__)


class OrganizationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    GET /api/organizations/ — organizations the logged-in user belongs to.

    The mobile app calls this right after login to decide whether to jump
    straight into the single org it gets back, or show a picker for more
    than one — no hardcoded organization id anywhere.
    """

    serializer_class = OrganizationSerializer

    def get_queryset(self):
        return Organization.objects.filter(memberships__user=self.request.user)

    def get_serializer_context(self):
        return {"request": self.request}


class CreateLinkTokenView(APIView):
    """POST /api/plaid/link-token/  {organization_id} -> {link_token}"""

    def post(self, request):
        serializer = LinkTokenRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = get_object_or_404(
            Organization, id=serializer.validated_data["organization_id"]
        )
        require_membership(request.user, organization.id)

        link_token = plaid_client.create_link_token(
            user_id=str(request.user.id), organization_name=organization.name
        )
        return Response({"link_token": link_token})


class ExchangePublicTokenView(APIView):
    """
    POST /api/plaid/exchange/  {organization_id, public_token, institution_id,
    institution_name} -> {plaid_item_id}

    Called right after Plaid Link's onSuccess in the mobile app. Kicks off an
    account sync immediately so the new accounts show up without waiting for
    the next scheduled sync.
    """

    def post(self, request):
        serializer = PublicTokenExchangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        organization = get_object_or_404(Organization, id=data["organization_id"])
        require_membership(request.user, organization.id)

        exchange = plaid_client.exchange_public_token(data["public_token"])

        institution, _ = Institution.objects.update_or_create(
            plaid_institution_id=data["institution_id"],
            defaults={"name": data["institution_name"]},
        )

        item, _ = PlaidItem.objects.update_or_create(
            plaid_item_id=exchange["item_id"],
            defaults={
                "organization": organization,
                "institution": institution,
                "access_token": exchange["access_token"],
                "status": PlaidItem.Status.ACTIVE,
            },
        )

        sync_item_accounts.delay(item.id)
        sync_item_statements.delay(item.id)

        return Response({"plaid_item_id": item.id}, status=status.HTTP_201_CREATED)


class BankAccountViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = BankAccountSerializer

    def get_queryset(self):
        organization_id = self.request.query_params.get("organization_id")
        require_membership(self.request.user, organization_id)
        return BankAccount.objects.filter(
            plaid_item__organization_id=organization_id
        ).select_related("plaid_item__institution")


class StatementViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = StatementSerializer

    def get_queryset(self):
        account_id = self.request.query_params.get("account_id")
        account = get_object_or_404(BankAccount, id=account_id)
        require_membership(self.request.user, account.plaid_item.organization_id)
        return Statement.objects.filter(account=account)


class CheckImageUploadViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """
    The only way check images enter the system: a human downloads them from
    their own bank portal and uploads the file here. See root README for why
    this isn't automated.
    """

    serializer_class = CheckImageUploadSerializer
    parser_classes = [MultiPartParser]

    def get_queryset(self):
        account_id = self.request.query_params.get("account_id")
        account = get_object_or_404(BankAccount, id=account_id)
        require_membership(self.request.user, account.plaid_item.organization_id)
        return CheckImageUpload.objects.filter(account=account)

    def perform_create(self, serializer):
        account = serializer.validated_data["account"]
        require_membership(self.request.user, account.plaid_item.organization_id)
        serializer.save(uploaded_by=self.request.user)


class PlaidWebhookView(APIView):
    """
    Receives Plaid webhooks (ITEM, STATEMENTS, etc). Not JWT-authenticated —
    Plaid calls this directly, using its own signed-JWT scheme instead — see
    https://plaid.com/docs/api/webhooks/webhook-verification/. Requests that
    fail signature verification are rejected with 400 before anything in the
    payload is trusted or acted on.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        # Read the raw body before anything (incl. DRF's parser) touches the
        # stream — the signature covers these exact bytes.
        raw_body = request.body

        signed_jwt = request.headers.get("Plaid-Verification")
        if not plaid_client.verify_webhook(raw_body, signed_jwt):
            logger.warning("Rejected Plaid webhook: signature verification failed")
            return Response(status=status.HTTP_400_BAD_REQUEST)

        payload = json.loads(raw_body)
        webhook_type = payload.get("webhook_type")
        webhook_code = payload.get("webhook_code")
        item_id = payload.get("item_id")
        logger.info("Plaid webhook: %s/%s for item %s", webhook_type, webhook_code, item_id)

        if webhook_type == "STATEMENTS" and item_id:
            item = PlaidItem.objects.filter(plaid_item_id=item_id).first()
            if item:
                sync_item_statements.delay(item.id)

        return Response(status=status.HTTP_200_OK)
