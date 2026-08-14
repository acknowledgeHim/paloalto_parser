from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

router = DefaultRouter()
router.register("organizations", views.OrganizationViewSet, basename="organization")
router.register("accounts", views.BankAccountViewSet, basename="bank-account")
router.register("statements", views.StatementViewSet, basename="statement")
router.register("check-images", views.CheckImageUploadViewSet, basename="check-image")

urlpatterns = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("plaid/link-token/", views.CreateLinkTokenView.as_view(), name="plaid-link-token"),
    path("plaid/exchange/", views.ExchangePublicTokenView.as_view(), name="plaid-exchange"),
    path("webhooks/plaid/", views.PlaidWebhookView.as_view(), name="plaid-webhook"),
    path("", include(router.urls)),
]
