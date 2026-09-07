from django.conf import settings


def coin_spending_enabled() -> bool:
    """Synthetic local use only until store, financial and release gates pass."""
    return settings.DEBUG is True and settings.COIN_SPENDING_MODE == "test"
