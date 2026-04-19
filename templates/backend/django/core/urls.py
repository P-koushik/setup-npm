from django.urls import path

from core.views import api_index, healthcheck

urlpatterns = [
    path("", api_index, name="api-index"),
    path("health/", healthcheck, name="health"),
]
