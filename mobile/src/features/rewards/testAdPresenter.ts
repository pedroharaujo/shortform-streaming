import * as Device from 'expo-device';
import { DEMO_REWARDED_UNIT_ID } from '../../../app.config';
import type { RewardedAdPresenter } from './types';

const failure = () => new Error('Test ad unavailable.');

function loadSdk(): typeof import('react-native-google-mobile-ads') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- load native SDK only after intentional opt-in
  return require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
}

export function createTestAdPresenter(
  environment: string,
  platform: string,
  rewardedUnitId: string = DEMO_REWARDED_UNIT_ID,
): RewardedAdPresenter {
  let prepared = false;
  let presenting = false;
  function check(isCurrent: () => boolean): void {
    if (!['local', 'staging'].includes(environment) || platform !== 'android' || !isCurrent())
      throw failure();
    if (
      rewardedUnitId !== DEMO_REWARDED_UNIT_ID &&
      (!__DEV__ || environment !== 'local' || Device.isDevice !== false)
    )
      throw failure();
  }
  return {
    async prepare(isCurrent) {
      prepared = false;
      check(isCurrent);
      const sdk = loadSdk();
      check(isCurrent);
      // A preference alone is not a CMP decision. Fail closed on UMP errors.
      const consent = await sdk.AdsConsent.gatherConsent();
      check(isCurrent);
      if (!consent.canRequestAds) throw failure();
      await sdk.default().setRequestConfiguration({ testDeviceIdentifiers: ['EMULATOR'] });
      check(isCurrent);
      await sdk.default().initialize();
      check(isCurrent);
      prepared = true;
    },
    async present(intent, isCurrent) {
      check(isCurrent);
      if (
        !prepared ||
        presenting ||
        intent.status !== 'pending' ||
        intent.ad_unit_id !== rewardedUnitId ||
        !intent.custom_data ||
        !intent.ssv_user_id ||
        !(Date.parse(intent.expires_at) > Date.now())
      )
        throw failure();
      presenting = true;
      try {
        const sdk = loadSdk();
        check(isCurrent);
        if (!(await sdk.AdsConsent.getConsentInfo()).canRequestAds) throw failure();
        check(isCurrent);
        const ad = sdk.RewardedAd.createForAdRequest(rewardedUnitId, {
          requestNonPersonalizedAdsOnly: true,
          serverSideVerificationOptions: {
            userId: intent.ssv_user_id,
            customData: intent.custom_data,
          },
        });
        return await new Promise<'completed' | 'dismissed'>((resolve, reject) => {
          let finished = false;
          let earned = false;
          let showing = false;
          const unsubscribe: (() => void)[] = [];
          const timeout = setTimeout(() => finish(), 120_000);
          const cancellation = setInterval(() => {
            if (!isCurrent()) finish();
          }, 250);
          function finish(result?: 'completed' | 'dismissed'): void {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            clearInterval(cancellation);
            unsubscribe.forEach((remove) => remove());
            if (result) resolve(result);
            else reject(failure());
          }
          unsubscribe.push(
            ad.addAdEventListener(sdk.RewardedAdEventType.LOADED, () => {
              void (async () => {
                if (finished || showing) return;
                check(isCurrent);
                if (
                  !(Date.parse(intent.expires_at) > Date.now()) ||
                  !(await sdk.AdsConsent.getConsentInfo()).canRequestAds
                )
                  throw failure();
                check(isCurrent);
                if (finished) return;
                showing = true;
                await ad.show();
              })().catch(() => finish());
            }),
          );
          unsubscribe.push(
            ad.addAdEventListener(sdk.RewardedAdEventType.EARNED_REWARD, () => {
              earned = true;
            }),
          );
          unsubscribe.push(
            ad.addAdEventListener(sdk.AdEventType.CLOSED, () =>
              finish(earned ? 'completed' : 'dismissed'),
            ),
          );
          unsubscribe.push(ad.addAdEventListener(sdk.AdEventType.ERROR, () => finish()));
          try {
            check(isCurrent);
            ad.load();
          } catch {
            finish();
          }
        });
      } finally {
        presenting = false;
      }
    },
    async privacy(isCurrent) {
      check(isCurrent);
      prepared = false;
      const sdk = loadSdk();
      const info = await sdk.AdsConsent.requestInfoUpdate();
      check(isCurrent);
      if (info.privacyOptionsRequirementStatus === 'REQUIRED') {
        await sdk.AdsConsent.showPrivacyOptionsForm();
      }
      check(isCurrent);
    },
  };
}
