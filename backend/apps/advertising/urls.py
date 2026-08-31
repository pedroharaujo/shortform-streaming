from django.urls import path

from apps.advertising.views import AdMobCallbackView, RewardIntentCreateView, RewardIntentDetailView

urlpatterns = [
    path("v1/rewards/admob/ssv", AdMobCallbackView.as_view(), name="admob-ssv"),
    path("v1/rewards/intents", RewardIntentCreateView.as_view(), name="reward-intent-create"),
    path(
        "v1/rewards/<uuid:reward_id>", RewardIntentDetailView.as_view(), name="reward-intent-detail"
    ),
]
