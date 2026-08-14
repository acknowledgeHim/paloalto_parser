from rest_framework.exceptions import PermissionDenied

from accounts.models import Membership


def require_membership(user, organization_id) -> Membership:
    membership = Membership.objects.filter(
        user=user, organization_id=organization_id
    ).first()
    if membership is None:
        raise PermissionDenied("Not a member of this organization.")
    return membership
