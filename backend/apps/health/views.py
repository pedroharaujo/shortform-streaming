from __future__ import annotations

from django.db import DatabaseError, connections
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import HealthStatusSerializer


class LiveView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        auth=[],
        tags=["health"],
        summary="Liveness probe",
        description="Process-only liveness. Does not query PostgreSQL.",
        responses={200: HealthStatusSerializer},
    )
    def get(self, request: Request) -> Response:
        return Response({"status": "ok"})


class ReadyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        auth=[],
        tags=["health"],
        summary="Readiness probe",
        description="Readiness including a bounded PostgreSQL SELECT 1.",
        responses={
            200: HealthStatusSerializer,
            503: OpenApiResponse(
                response=HealthStatusSerializer,
                description="PostgreSQL is unreachable or the probe query failed.",
            ),
        },
    )
    def get(self, request: Request) -> Response:
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT 1")
        except DatabaseError:
            return Response({"status": "unavailable"}, status=503)
        return Response({"status": "ok"})
