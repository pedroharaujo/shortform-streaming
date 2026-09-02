import { createContext, useContext, type JSX, type PropsWithChildren } from 'react';

export interface AppMessages {
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
