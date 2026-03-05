from rest_framework.permissions import BasePermission


class HasRole(BasePermission):
    allowed_roles: set[str] = set()

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.role in self.allowed_roles)


class IsAdminRole(HasRole):
    allowed_roles = {"ADMIN"}


class IsTeacherRole(HasRole):
    allowed_roles = {"TEACHER"}


class IsParentRole(HasRole):
    allowed_roles = {"PARENT"}


class IsAdminOrTeacher(HasRole):
    allowed_roles = {"ADMIN", "TEACHER"}
