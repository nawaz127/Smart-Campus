from django.contrib import admin
from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView


def root_status(request):
    return JsonResponse(
        {
            "service": "Begum Shahanara Smart Campus Backend",
            "status": "online",
            "docs": "/api/schema/swagger/",
            "api": "/api/v1/",
        }
    )


def healthz(request):
    return JsonResponse({"status": "ok"})


def readyz(request):
    try:
        connections["default"].cursor()
        db_status = "ok"
    except OperationalError:
        db_status = "error"
    return JsonResponse({"status": "ok" if db_status == "ok" else "degraded", "database": db_status})

urlpatterns = [
    path("", root_status, name="root-status"),
    path("healthz/", healthz, name="healthz"),
    path("readyz/", readyz, name="readyz"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
