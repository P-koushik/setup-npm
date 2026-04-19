from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def api_index(_request):
    return Response(
        {
            "service": "django-production-template",
            "message": "API is ready",
        }
    )


@api_view(["GET"])
def healthcheck(_request):
    return Response(
        {
            "status": "ok",
            "service": "django-production-template",
        }
    )
