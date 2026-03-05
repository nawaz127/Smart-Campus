from django.contrib import admin
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

urlpatterns = [
    path("", root_status, name="root-status"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
