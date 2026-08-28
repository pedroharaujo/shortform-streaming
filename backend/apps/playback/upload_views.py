from __future__ import annotations

from django.conf import settings
from django.http import (
    Http404,
    HttpRequest,
    HttpResponse,
    HttpResponseForbidden,
    HttpResponseNotAllowed,
)
from django.views.decorators.csrf import csrf_exempt

from apps.playback.objectstore import (
    FakeObjectStore,
    get_object_store,
    staff_master_object_key,
    verify_staff_put_signature,
)


@csrf_exempt
def fake_staff_master_put(request: HttpRequest, pk: int) -> HttpResponse:
    """CSRF-exempt PUT for the in-process Fake store. Not registered in production."""
    if request.method != "PUT":
        return HttpResponseNotAllowed(["PUT"])
    store = get_object_store()
    if not isinstance(store, FakeObjectStore):
        raise Http404()
    try:
        object_key = staff_master_object_key(pk)
    except ValueError:
        return HttpResponseForbidden()
    signature = str(request.GET.get("sig") or "")
    raw_exp = str(request.GET.get("exp") or "")
    try:
        expires_unix = int(raw_exp)
    except ValueError:
        return HttpResponseForbidden()
    if not verify_staff_put_signature(
        hmac_key=str(getattr(settings, "SECRET_KEY", "") or ""),
        object_key=object_key,
        expires_unix=expires_unix,
        signature=signature,
    ):
        return HttpResponseForbidden()
    store.put_bytes(object_key, request.body)
    return HttpResponse(status=204)
