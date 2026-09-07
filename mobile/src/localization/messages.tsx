import { createContext, useContext, type JSX, type PropsWithChildren } from 'react';

export interface AppMessages {
  readonly wallet: {
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
    readonly countryCode: string;
    readonly countryHint: string;
    readonly countryPlaceholder: string;
    readonly currentCredential: string;
    readonly deleteAccount: string;
    readonly deleted: string;
    readonly deletionPending: string;
    readonly deletionResponseLost: string;
    readonly deletionWarning: string;
    readonly languageEnglish: string;
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
  };
  readonly auth: {
    readonly authenticationFailed: string;
    readonly createAccount: string;
    readonly description: string;
    readonly email: string;
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
  };
}

export const englishMessages: AppMessages = {
  wallet: {
    title: 'Coin wallet',
    balance: (coins) => `${coins} coins`,
    loading: 'Loading balance…',
    refresh: 'Refresh balance',
    unavailable: 'Your balance could not be checked. Check your connection and try again.',
    signIn: 'Sign in to see your balance and unlock episodes.',
    sessionChanged: 'Your session changed. Reopen this screen from Account.',
    purchasesUnavailable: 'Coin purchases are not available yet.',
    spendingUnavailable: 'Coin unlocks are unavailable in this build.',
    backToEpisode: 'Back to episode',
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
    countryCode: 'Country code',
    countryHint: 'Country is an account preference. It does not change where content is available.',
    countryPlaceholder: 'Country code (optional)',
    currentCredential: 'Current password',
    deleteAccount: 'Delete account',
    deleted: 'Your account has been deleted. You are signed out.',
    deletionPending:
      'Deletion accepted. App account data has been deleted; identity-provider cleanup is pending. You are signed out.',
    deletionResponseLost:
      'The response was lost. Your deletion request may already have been accepted. Signing in cannot verify deletion. Contact support to verify completion.',
    deletionWarning:
      'This permanently removes your profile, watch progress, and access grants. This cannot be undone. Identity-provider cleanup may remain pending.',
    languageEnglish: 'Language: English',
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
  },
  auth: {
    authenticationFailed: 'Sign-in could not be completed. Check your details and try again.',
    createAccount: 'Create account',
    description:
      'Use email and password or Google Sign-In. You can browse the catalog without an account.',
    email: 'Email',
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
