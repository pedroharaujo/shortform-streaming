import { createContext, useContext, type JSX, type PropsWithChildren } from 'react';

export interface AppMessages {
  readonly support: {
    readonly title: string;
    readonly description: string;
    readonly withReference: string;
    readonly emailSupport: string;
    readonly emailBody: string;
    readonly subjects: {
      readonly general: string;
      readonly purchase: string;
      readonly unlock: string;
    };
    readonly opening: string;
    readonly openFailed: string;
    readonly operator: (name: string) => string;
    readonly privacyPolicy: string;
    readonly privacyPolicyDescription: string;
  };
  readonly coinStore: {
    readonly title: string;
    readonly description: string;
    readonly choosePack: string;
    readonly selection: string;
    readonly moreCoins: (percent: number) => string;
    readonly selectPack: string;
    readonly buy: (coins: number, price: string) => string;
    readonly previewBuy: (coins: number, price: string) => string;
    readonly empty: string;
    readonly processing: string;
    readonly done: string;
    readonly coinUnit: string;
    readonly balanceLabel: string;
  };
  readonly purchasePreview: {
    readonly badge: string;
    readonly notice: string;
    readonly examplePack: string;
    readonly packLabel: (coins: number, price: string) => string;
    readonly loading: string;
    readonly unavailable: string;
    readonly checkout: string;
    readonly confirmation: string;
    readonly simulate: string;
    readonly cancel: string;
    readonly complete: string;
    readonly completeDescription: string;
    readonly again: string;
  };
  readonly design: {
    readonly accountDescription: string;
    readonly privacy: string;
    readonly privacyDescription: string;
    readonly securityDescription: string;
    readonly security: string;
    readonly walletDescription: string;
    readonly balanceLabel: string;
    readonly purchaseDescription: string;
    readonly unlockDescription: string;
  };
  readonly coinPacks: {
    readonly purchaseNotAllowed: string;
    readonly productUnavailable: string;
    readonly title: string;
    readonly description: string;
    readonly loading: string;
    readonly unavailable: string;
    readonly busy: string;
    readonly pending: string;
    readonly checkPurchase: string;
    readonly cancelled: string;
    readonly reload: string;
    readonly storageUnavailable: string;
    readonly credited: string;
    readonly walletUnavailable: string;
    readonly openWallet: string;
    readonly coins: (coins: number) => string;
  };
  readonly purchases: {
    readonly title: string;
    readonly loading: string;
    readonly refresh: string;
    readonly unavailable: string;
    readonly signIn: string;
    readonly sessionChanged: string;
    readonly historyExplanation: string;
    readonly empty: string;
    readonly latestOnly: string;
    readonly historicalCoins: (coins: number) => string;
    readonly recordedAt: (date: string) => string;
    readonly supportReference: (reference: string) => string;
    readonly credited: string;
    readonly reviewRequired: string;
  };
  readonly wallet: {
    readonly shortBalance: (coins: number) => string;
    readonly shortcutBalance: (coins: number) => string;
    readonly shortcutTitle: string;
    readonly shortcutUnavailable: string;
    readonly openWallet: string;
    readonly title: string;
    readonly balance: (coins: number) => string;
    readonly loading: string;
    readonly refresh: string;
    readonly unavailable: string;
    readonly signIn: string;
    readonly sessionChanged: string;
    readonly purchasesUnavailable: string;
    readonly spendingUnavailable: string;
    readonly backToEpisode: string;
    readonly recoveryUnavailable: string;
    readonly retryRecovery: string;
    readonly activityTitle: string;
    readonly activityEmpty: string;
    readonly activityUnavailable: string;
    readonly activityLoading: string;
    readonly activityPurchase: string;
    readonly activityUnlock: (title: string | null) => string;
    readonly activityCorrection: string;
    readonly activityAmount: (amount: number) => string;
    readonly activityBalanceAfter: (coins: number) => string;
    readonly activityLatest: string;
    readonly activityWhen: (isoDate: string) => string;
    readonly subtitle: string;
    readonly topUp: string;
    readonly closePacks: string;
  };
  readonly unlock: {
    readonly title: string;
    readonly loading: string;
    readonly unavailable: string;
    readonly noMethods: string;
    readonly refresh: string;
    readonly coins: (price: number) => string;
    readonly confirm: (price: number) => string;
    readonly terms: string;
    readonly cancel: string;
    readonly insufficient: string;
    readonly watchAd: string;
    readonly adsConsent: string;
    readonly pending: string;
    readonly cancelled: string;
    readonly checkPending: string;
    readonly unresolved: (reference: string) => string;
    readonly storageUnavailable: string;
    readonly changed: string;
    readonly verifying: string;
    readonly playbackUnavailable: string;
    readonly alreadyUnlocked: string;
  };
  readonly account: {
    readonly adsConsent: string;
    readonly analyticsConsent: string;
    readonly backHome: string;
    readonly backToEpisode: string;
    readonly cancelDeletion: string;
    readonly cleanupFailed: string;
    readonly confirmDeletion: string;
    readonly currentCredential: string;
    readonly deleteAccount: string;
    readonly deleted: string;
    readonly deletionPending: string;
    readonly deletionResponseLost: string;
    readonly deletionWarning: string;
    readonly loading: string;
    readonly preferencesHint: string;
    readonly preferencesSaved: string;
    readonly requestFailed: string;
    readonly retryDeviceSignOut: string;
    readonly retryLoading: string;
    readonly savePreferences: string;
    readonly serviceUnreachable: string;
    readonly sessionChanged: string;
    readonly signInAgain: string;
    readonly signOut: string;
    readonly signedOut: string;
    readonly signedOutApp: string;
    readonly verificationCancelled: string;
    readonly verificationExpired: string;
    readonly verificationFailed: string;
    readonly verificationHint: string;
    readonly verifyGoogleDelete: string;
    readonly verifyCredentialDelete: string;
    readonly autoUnlock: string;
    readonly autoUnlockHint: string;
  };
  readonly auth: {
    readonly authenticationFailed: string;
    readonly changeEmail: string;
    readonly continue: string;
    readonly createAccount: string;
    readonly description: string;
    readonly email: string;
    readonly emailHintLogin: string;
    readonly emailHintSignUp: string;
    readonly emailTitleLogin: string;
    readonly emailTitleSignUp: string;
    readonly haveAccount: string;
    readonly hideCredential: string;
    readonly invalidEmail: string;
    readonly loginFailed: string;
    readonly or: string;
    readonly credentialHintSignUp: string;
    readonly credentialTitleLogin: string;
    readonly credentialTitleSignUp: string;
    readonly showCredential: string;
    readonly signUpFailed: string;
    readonly step: (current: number, total: number) => string;
    readonly switchToLogin: string;
    readonly switchToSignUp: string;
    readonly tagline: string;
    readonly credential: string;
    readonly profileFailed: string;
    readonly profileUnreachable: string;
    readonly sessionChanged: string;
    readonly signInGoogle: string;
    readonly signOut: string;
    readonly signedInAs: (publicId: string) => string;
    readonly signedOut: string;
    readonly title: string;
  };
  readonly common: {
    readonly account: string;
    readonly back: string;
    readonly play: string;
    readonly retry: string;
    readonly signIn: string;
  };
  readonly nav: {
    readonly home: string;
    readonly wallet: string;
    readonly account: string;
  };
  readonly playback: {
    readonly close: string;
    readonly episodeUnavailable: string;
    readonly failed: string;
    readonly loading: string;
    readonly loadingLabel: string;
    readonly rewardRequired: string;
    readonly viewReward: string;
  };
  readonly catalog: {
    readonly brand: string;
    readonly tagline: string;
    readonly discover: string;
    readonly viewSeries: string;
    readonly featured: string;
    readonly synopsis: string;
    readonly episodes: string;
    readonly startWatching: string;
    readonly seriesCount: (count: number) => string;
    readonly allGenres: string;
    readonly freeEpisodes: (count: number) => string;
    readonly emptyHint: string;
    readonly episodeCount: (count: number) => string;
    readonly duration: (seconds: number) => string;
    readonly empty: string;
    readonly episode: (order: number) => string;
    readonly episodeLabel: (order: number, title: string) => string;
    readonly episodeLoading: string;
    readonly episodeLoadingLabel: string;
    readonly episodeNotAvailable: string;
    readonly homeTitle: string;
    readonly loading: string;
    readonly loadingLabel: string;
    readonly requestFailed: string;
    readonly season: (number: number) => string;
    readonly selectedEpisode: string;
    readonly seriesLoading: string;
    readonly seriesLoadingLabel: string;
    readonly titleNotAvailable: string;
    readonly unreachable: string;
    readonly continueWatching: string;
    readonly resumeEpisode: (order: number, title: string) => string;
    readonly resume: string;
  };
}

export const englishMessages: AppMessages = {
  support: {
    title: 'Help & Support',
    description:
      'For help with your account, purchases or privacy, email us. You can also select and copy the address.',
    withReference:
      'Your email app will open a draft with this reference. Review it before sending. You can also select and copy the address and reference.',
    emailSupport: 'Email support',
    emailBody:
      'Please describe what happened. Do not include passwords, verification codes or payment card details.',
    subjects: {
      general: 'Stovio — Support and privacy',
      purchase: 'Stovio — Coin purchase support',
      unlock: 'Stovio — Episode unlock support',
    },
    opening: 'Opening…',
    openFailed:
      'Could not open an app for this link. You can email the support address from another device or email service.',
    operator: (name) => `Operated by ${name}`,
    privacyPolicy: 'Privacy policy',
    privacyPolicyDescription:
      'Opens in your browser. Contact us by email with any privacy questions.',
  },
  coinStore: {
    title: 'Coins',
    description: 'Your balance and coin packs, together.',
    choosePack: 'Choose your pack',
    selection: 'Your selection',
    moreCoins: (percent) => `+${percent}% more coins`,
    selectPack: 'Select a pack',
    buy: (coins, price) => `Buy ${coins.toLocaleString('en-US')} coins \u00b7 ${price}`,
    previewBuy: (coins, price) => `Preview ${coins.toLocaleString('en-US')} coins \u00b7 ${price}`,
    empty:
      'No coin packs are available right now. You can still check your balance and recent purchases.',
    processing: 'Checking your purchase\u2026',
    done: 'Done',
    coinUnit: 'coins',
    balanceLabel: 'Your balance',
  },
  purchasePreview: {
    badge: 'DESIGN PREVIEW - NO CHARGES',
    notice: 'Example packs and prices. Nothing will be charged or added to your wallet.',
    examplePack: 'Example pack',
    packLabel: (coins, price) => `Example pack: ${coins} coins, ${price}`,
    loading: 'Loading coin packs\u2026',
    unavailable: 'Coin packs could not be loaded from the server.',
    checkout: 'Preview checkout',
    confirmation: 'Preview confirmation',
    simulate: 'Simulate purchase',
    cancel: 'Cancel preview',
    complete: 'Preview complete',
    completeDescription:
      'This was a design preview. No payment was made and your coin balance is unchanged.',
    again: 'Try another pack',
  },
  design: {
    accountDescription: 'Your wallet, purchases and settings.',
    privacy: 'Privacy & consent',
    privacyDescription: 'Choose how the app uses your data.',
    securityDescription: 'Manage your account and deletion options.',
    security: 'Account management',
    walletDescription: 'Keep your next episode within reach.',
    balanceLabel: 'AVAILABLE BALANCE',
    purchaseDescription: 'Your verified coin purchases, in one place.',
    unlockDescription: 'Choose how to continue your story.',
  },
  coinPacks: {
    purchaseNotAllowed:
      'Google Play did not allow this purchase. Check your payment method or Play account, then try again.',
    productUnavailable:
      'Google Play could not sell this pack. You were not charged. Reload coin packs to check availability.',
    title: 'Buy coins',
    description:
      'Test checkout only. Use Google Play’s test payment method for a no-charge purchase. Cancel if a real payment method appears. Coins are added after verification.',
    loading: 'Checking coin packs and purchases…',
    unavailable: 'Coin purchases are unavailable right now. Check your connection and try again.',
    busy: 'Another purchase is being checked. Check again in a moment.',
    pending: 'Your purchase still needs to be checked before buying again.',
    checkPurchase: 'Check purchase',
    cancelled: 'Purchase cancelled. You can choose a pack again.',
    reload: 'Reload coin packs',
    storageUnavailable: 'Your purchase could not be saved safely. Please try again before buying.',
    credited: 'Your purchase has been verified and its coins credited.',
    walletUnavailable:
      'Your current balance could not be loaded. Refresh your balance to check it.',
    openWallet: 'View coins',
    coins: (coins) => `${coins} coins`,
  },
  purchases: {
    title: 'Recent purchases',
    loading: 'Loading purchase history…',
    refresh: 'Refresh purchases',
    unavailable: 'Your purchase history could not be checked. Check your connection and try again.',
    signIn: 'Sign in to see your recent purchases.',
    sessionChanged: 'Your session changed. Reopen this screen from Account.',
    historyExplanation:
      'These are historical coin credits, not your current spendable balance. Check your wallet for your current balance. Refunds and other unresolved changes may still need review.',
    empty:
      'No verified purchases are recorded here yet. This does not mean a purchase failed. Check again before buying again.',
    latestOnly: 'Showing the latest 20 purchases. Older purchases are not shown.',
    historicalCoins: (coins) => `${coins} coins credited originally`,
    recordedAt: (date) =>
      `Recorded ${new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      })}`,
    supportReference: (reference) => `Support reference: ${reference}`,
    credited: 'Credit recorded',
    reviewRequired:
      'Review required. Keep this support reference; this record does not confirm a refund or final settlement.',
  },
  wallet: {
    shortBalance: (coins) => coins.toLocaleString('en-US'),
    shortcutBalance: (coins) => `Coins, ${coins.toLocaleString('en-US')} coins`,
    shortcutTitle: 'Coins',
    shortcutUnavailable: 'Coins, balance unavailable',
    openWallet: 'View your balance and buy coins',
    title: 'Coins',
    balance: (coins) => `${coins} coins`,
    loading: 'Loading balance…',
    refresh: 'Refresh balance',
    unavailable: 'Your balance could not be checked. Check your connection and try again.',
    signIn: 'Sign in to see your balance and unlock episodes.',
    sessionChanged: 'Your session changed. Reopen this screen from Account.',
    purchasesUnavailable: 'Coin purchases are not available yet.',
    spendingUnavailable: 'Coin unlocks are unavailable in this build.',
    backToEpisode: 'Back to episode',
    recoveryUnavailable: 'A saved coin unlock could not be checked. Try again.',
    retryRecovery: 'Retry coin unlock check',
    activityTitle: 'Transaction activity',
    activityEmpty: 'No coin activity yet. Purchases and episode unlocks will show up here.',
    activityUnavailable: 'Coin activity could not be loaded.',
    activityLoading: 'Loading activity…',
    activityPurchase: 'Coin purchase',
    activityUnlock: (title) => (title === null ? 'Episode unlock' : `Unlocked ${title}`),
    activityCorrection: 'Balance correction',
    activityAmount: (amount) => `${amount > 0 ? '+' : ''}${amount.toLocaleString('en-US')} coins`,
    activityBalanceAfter: (coins) => `Balance after: ${coins.toLocaleString('en-US')} coins`,
    activityLatest: 'Latest activity',
    activityWhen: (isoDate) =>
      new Date(isoDate).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    subtitle: 'Your balance, coin packs and every coin you spend.',
    topUp: 'Top up coins',
    closePacks: 'Close coin packs',
  },
  unlock: {
    title: 'Unlock episode',
    loading: 'Loading episode options…',
    unavailable: 'Episode options could not be checked. Check your connection and try again.',
    noMethods: 'No unlock option is available for this episode right now.',
    refresh: 'Refresh episode options',
    coins: (price) => `Use ${price} coins`,
    confirm: (price) => `Confirm ${price} coins`,
    terms: 'Unlock this episode with coins. Playback remains subject to title availability.',
    cancel: 'Cancel',
    insufficient: 'You do not have enough coins for this episode.',
    watchAd: 'Watch an ad',
    adsConsent: 'Turn on your ads preference in Account to watch a rewarded ad.',
    pending:
      'An unlock request needs to be checked before starting another unlock for this episode.',
    cancelled:
      'The interrupted request was cancelled without spending coins. Review the current options and confirm the price to unlock.',
    checkPending: 'Check coin unlock',
    unresolved: (reference) =>
      `This unlock needs a support review. Keep this unlock reference: ${reference}. No new coin request will be sent for this episode.`,
    storageUnavailable:
      'Secure unlock recovery is unavailable. No new unlock request can be sent. Try again later.',
    changed:
      'The unlock could not be completed. Refresh the options and confirm the current price to try again.',
    verifying: 'Checking your balance and episode access…',
    playbackUnavailable: 'Playback could not be confirmed. Check your connection and try again.',
    alreadyUnlocked: 'This episode is unlocked. Continue to playback.',
  },
  account: {
    adsConsent: 'Ads consent',
    analyticsConsent: 'Analytics consent',
    backHome: 'Back to home',
    backToEpisode: 'Back to episode',
    cancelDeletion: 'Cancel deletion',
    cleanupFailed:
      'The app session is cleared, but native sign-out failed. Retry to finish signing out on this device.',
    confirmDeletion: 'Confirm account deletion',
    currentCredential: 'Current password',
    deleteAccount: 'Delete account',
    deleted: 'Your account has been deleted. You are signed out.',
    deletionPending:
      'Deletion accepted. App account data has been deleted; identity-provider cleanup is pending. You are signed out.',
    deletionResponseLost:
      'The response was lost. Your deletion request may already have been accepted. Signing in cannot verify deletion. Contact support to verify completion.',
    deletionWarning:
      'This permanently removes your profile, watch progress, and access grants. This cannot be undone. Identity-provider cleanup may remain pending.',
    loading: 'Loading account…',
    preferencesHint:
      'Optional preferences are off by default. Analytics activates only after the server saves consent. Turning it off, signing out, or deleting your account clears the analytics identity and local analytics data.',
    preferencesSaved: 'Preferences saved.',
    requestFailed: 'The request could not be completed. Please try again.',
    retryDeviceSignOut: 'Retry device sign-out',
    retryLoading: 'Retry account loading',
    savePreferences: 'Save preferences',
    serviceUnreachable: 'Unable to reach the account service. Check your connection and try again.',
    sessionChanged: 'Your session changed. Return home and reopen Account.',
    signInAgain: 'Sign in again to manage your account.',
    signOut: 'Sign out',
    signedOut: 'Signed out.',
    signedOutApp: 'Signed out of the app.',
    verificationCancelled: 'Verification cancelled. No deletion request was sent.',
    verificationExpired: 'Verification expired. Verify your account again to request deletion.',
    verificationFailed: 'Account verification failed. Try again.',
    verificationHint:
      'Verify using the account you are currently signed in to. Use your password or the same Google account.',
    verifyGoogleDelete: 'Verify Google and delete account',
    verifyCredentialDelete: 'Verify password and delete account',
    autoUnlock: 'Auto-unlock next episode',
    autoUnlockHint:
      'When an episode ends, spend coins on the next one if your balance covers the current price.',
  },
  auth: {
    authenticationFailed: 'Sign-in could not be completed. Check your details and try again.',
    changeEmail: 'Change',
    continue: 'Continue',
    createAccount: 'Create account',
    description: 'Continue with email or Google.',
    email: 'Email',
    emailHintLogin: 'Use the email you signed up with.',
    emailHintSignUp: 'Your episodes, progress, and coins stay with this account.',
    emailTitleLogin: 'Welcome back',
    emailTitleSignUp: 'What’s your email?',
    haveAccount: 'I already have an account',
    hideCredential: 'Hide password',
    invalidEmail: 'Enter a valid email address.',
    loginFailed: 'That email and password don’t match. Try again, or create an account.',
    or: 'or',
    credentialHintSignUp: 'Use at least 6 characters.',
    credentialTitleLogin: 'Enter your password',
    credentialTitleSignUp: 'Create a password',
    showCredential: 'Show password',
    signUpFailed:
      'This account could not be created. The email may already be registered, or the password is too short.',
    step: (current, total) => `Step ${current} of ${total}`,
    switchToLogin: 'Already have an account? Sign in',
    switchToSignUp: 'New to Stovio? Create an account',
    tagline: 'Great productions.\nThe best stories, one episode at a time.',
    credential: 'Password',
    profileFailed: 'Your account could not be loaded. Please try again.',
    profileUnreachable: 'Unable to reach the account service. Check your connection and try again.',
    sessionChanged: 'Your session changed. Reopen Sign in before continuing.',
    signInGoogle: 'Sign in with Google',
    signOut: 'Sign out',
    signedInAs: (publicId) => `Signed in as ${publicId}`,
    signedOut: 'Signed out',
    title: 'Sign in',
  },
  common: {
    account: 'Account',
    back: 'Back',
    play: 'Play',
    retry: 'Try again',
    signIn: 'Sign in',
  },
  nav: {
    home: 'Home',
    wallet: 'Wallet',
    account: 'Account',
  },
  playback: {
    close: 'Close',
    episodeUnavailable: 'This episode is not available.',
    failed: 'Playback could not be started.',
    loading: 'Loading playback…',
    loadingLabel: 'Loading playback',
    rewardRequired: 'Unlock this episode to keep watching.',
    viewReward: 'View episode options',
  },
  catalog: {
    brand: 'Stovio',
    tagline: 'Small episodes. Big emotions.',
    discover: 'Find your next story',
    viewSeries: 'Explore series',
    featured: 'Featured',
    synopsis: 'Synopsis',
    episodes: 'Episodes',
    startWatching: 'Start watching',
    seriesCount: (count) => `${count} ${count === 1 ? 'title' : 'titles'}`,
    allGenres: 'All',
    freeEpisodes: (count) =>
      count === 1 ? '1 free episode' : `${count.toLocaleString('en-US')} free episodes`,
    emptyHint: 'Your next story is on its way. Check back soon.',
    episodeCount: (count) => `${count} ${count === 1 ? 'episode' : 'episodes'}`,
    duration: (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    empty: 'No titles are available.',
    episode: (order) => `Episode ${order}`,
    episodeLabel: (order, title) => `Episode ${order}. ${title}`,
    episodeLoading: 'Loading episode…',
    episodeLoadingLabel: 'Loading episode',
    episodeNotAvailable: 'This episode is not available.',
    homeTitle: 'Home',
    loading: 'Loading catalog…',
    loadingLabel: 'Loading catalog',
    requestFailed: 'The catalog could not be loaded. Please try again.',
    season: (number) => `Season ${number}`,
    selectedEpisode: 'Selected episode',
    seriesLoading: 'Loading series…',
    seriesLoadingLabel: 'Loading series',
    titleNotAvailable: 'This title is not available.',
    unreachable: 'Unable to reach the catalog. Check your connection and try again.',
    continueWatching: 'Continue watching',
    resumeEpisode: (order, title) => `Resume episode ${order}, ${title}`,
    resume: 'Resume',
  },
};

const MessagesContext = createContext<AppMessages>(englishMessages);

export function MessagesProvider({
  children,
  messages = englishMessages,
}: PropsWithChildren<{ readonly messages?: AppMessages }>): JSX.Element {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}

export function useMessages(): AppMessages {
  return useContext(MessagesContext);
}
