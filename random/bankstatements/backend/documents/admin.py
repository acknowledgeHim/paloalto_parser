from django.contrib import admin

from .models import CheckImageUpload, Statement


@admin.register(Statement)
class StatementAdmin(admin.ModelAdmin):
    list_display = ("account", "period_start", "period_end", "synced_at")
    list_filter = ("account__plaid_item__organization",)
    readonly_fields = ("plaid_statement_id", "synced_at")


@admin.register(CheckImageUpload)
class CheckImageUploadAdmin(admin.ModelAdmin):
    list_display = ("account", "uploaded_by", "check_date", "uploaded_at")
    list_filter = ("account__plaid_item__organization",)
    readonly_fields = ("uploaded_at",)
