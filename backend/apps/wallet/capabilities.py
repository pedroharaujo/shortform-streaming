from django.conf import settings


def coin_spending_enabled() -> bool:
    """Explicit local tests or the secure hosted sandbox; production stays closed."""
    if getattr(settings, "HOSTED_SANDBOX", False) is True:
        return bool(settings.COIN_SPENDING_MODE == "revenuecat_sandbox")
    return settings.DEBUG is True and settings.COIN_SPENDING_MODE == "test"
