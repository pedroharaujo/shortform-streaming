import { createContext, useContext, type JSX, type PropsWithChildren } from 'react';

export interface AppMessages {
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
