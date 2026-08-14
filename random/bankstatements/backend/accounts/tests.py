from django.db import IntegrityError
from django.test import TestCase

from .models import Membership, Organization, User


class MembershipTests(TestCase):
    def test_a_user_can_only_have_one_membership_per_organization(self):
        user = User.objects.create_user(username="alice", email="alice@example.com", password="x")
        org = Organization.objects.create(name="Acme LLC")
        Membership.objects.create(user=user, organization=org, role=Membership.Role.OWNER)

        with self.assertRaises(IntegrityError):
            Membership.objects.create(user=user, organization=org, role=Membership.Role.VIEWER)
