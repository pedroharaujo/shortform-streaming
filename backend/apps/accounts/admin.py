from __future__ import annotations

from typing import Any

from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin, UserAdmin
from django.contrib.auth.models import Group, User
from django.http import HttpRequest


class SuperuserOnlyAuthAdminMixin:
    """Keep staff-role administration behind a separate superuser boundary."""

    @staticmethod
    def _is_superuser(request: HttpRequest) -> bool:
        return bool(request.user.is_active and request.user.is_superuser)

    def has_module_permission(self, request: HttpRequest) -> bool:
        return self._is_superuser(request)

    def has_view_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        del obj
        return self._is_superuser(request)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return self._is_superuser(request)

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        del obj
        return self._is_superuser(request)

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        del obj
        return self._is_superuser(request)


class SuperuserOnlyUserAdmin(SuperuserOnlyAuthAdminMixin, UserAdmin):  # type: ignore[type-arg]
    pass


class SuperuserOnlyGroupAdmin(SuperuserOnlyAuthAdminMixin, GroupAdmin):
    pass


if admin.site.is_registered(User):
    admin.site.unregister(User)
if admin.site.is_registered(Group):
    admin.site.unregister(Group)
admin.site.register(User, SuperuserOnlyUserAdmin)
admin.site.register(Group, SuperuserOnlyGroupAdmin)
