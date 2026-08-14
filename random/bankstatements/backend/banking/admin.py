from django.contrib import admin

from .models import BankAccount, Institution, PlaidItem


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("name", "plaid_institution_id")
    search_fields = ("name",)


class BankAccountInline(admin.TabularInline):
    model = BankAccount
    extra = 0
    readonly_fields = ("plaid_account_id",)


@admin.register(PlaidItem)
class PlaidItemAdmin(admin.ModelAdmin):
    # access_token deliberately excluded — never show it, even to staff, in the UI.
    list_display = ("institution", "organization", "status", "last_synced_at")
    list_filter = ("status",)
    readonly_fields = ("plaid_item_id", "created_at", "last_synced_at")
    exclude = ("access_token",)
    inlines = [BankAccountInline]


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "mask", "plaid_item")
