from rest_framework import serializers

from accounts.models import Membership, Organization
from banking.models import BankAccount, Institution
from documents.models import CheckImageUpload, Statement


class OrganizationSerializer(serializers.ModelSerializer):
    """An org the requesting user belongs to, with their role in it."""

    role = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ["id", "name", "role"]

    def get_role(self, organization: Organization) -> str:
        membership: Membership = organization.memberships.get(user=self.context["request"].user)
        return membership.role


class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        fields = ["id", "name", "logo_url"]


class BankAccountSerializer(serializers.ModelSerializer):
    institution = InstitutionSerializer(source="plaid_item.institution", read_only=True)

    class Meta:
        model = BankAccount
        fields = ["id", "name", "mask", "account_type", "account_subtype", "institution"]


class StatementSerializer(serializers.ModelSerializer):
    account = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Statement
        fields = ["id", "account", "period_start", "period_end", "file", "synced_at"]
        read_only_fields = fields


# Signature -> the only content types check-image uploads may actually be.
# Checked against the file's real bytes, not its extension or client-supplied
# Content-Type — both of those are attacker-controlled. This is what stops
# someone uploading a `.jpg`-named HTML/SVG file that a browser would later
# render as active content instead of an image.
_ALLOWED_FILE_SIGNATURES = (
    b"%PDF",
    b"\xff\xd8\xff",  # JPEG
    b"\x89PNG\r\n\x1a\n",
)


class CheckImageUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = CheckImageUpload
        fields = ["id", "account", "file", "check_date", "note", "uploaded_at", "uploaded_by"]
        read_only_fields = ["id", "uploaded_at", "uploaded_by"]

    def validate_file(self, uploaded_file):
        header = uploaded_file.read(8)
        uploaded_file.seek(0)
        if not any(header.startswith(sig) for sig in _ALLOWED_FILE_SIGNATURES):
            raise serializers.ValidationError(
                "File must be a PDF, JPEG, or PNG (a check image or scanned document)."
            )
        return uploaded_file


class LinkTokenRequestSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()


class PublicTokenExchangeSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()
    public_token = serializers.CharField()
    # Supplied from Plaid Link's onSuccess `metadata.institution` on the client —
    # the exchange endpoint itself doesn't return institution details.
    institution_id = serializers.CharField()
    institution_name = serializers.CharField()
