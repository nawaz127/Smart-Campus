from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "username", "role", "school", "is_active", "is_staff")
    list_filter = ("role", "school", "is_active", "is_staff")
    search_fields = ("email", "username")
    ordering = ("email",)
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Campus Context",
            {
                "fields": (
                    "role",
                    "school",
                    "phone",
                )
            },
        ),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (
            "Campus Context",
            {
                "fields": (
                    "role",
                    "school",
                    "phone",
                )
            },
        ),
    )
