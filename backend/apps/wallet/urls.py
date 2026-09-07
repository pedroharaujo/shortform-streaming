from django.urls import path

from apps.wallet.views import CoinUnlockResolutionView, CoinUnlockView, WalletView

urlpatterns = [
    path("v1/wallet", WalletView.as_view(), name="wallet-detail"),
    path("v1/coins/unlock", CoinUnlockView.as_view(), name="coin-unlock"),
    path("v1/coins/unlock/resolve", CoinUnlockResolutionView.as_view(), name="coin-unlock-resolve"),
]
