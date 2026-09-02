import type { ComponentProps, ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { englishMessages, MessagesProvider, type AppMessages } from './localization/messages';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export const compactAndroidMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 480 },
  insets: { top: 24, left: 0, right: 0, bottom: 24 },
};

interface RenderWithSafeAreaOptions {
  readonly messages?: AppMessages;
  readonly metrics?: NonNullable<ComponentProps<typeof SafeAreaProvider>['initialMetrics']>;
}

export function renderWithSafeArea(
  ui: ReactElement,
  { messages = englishMessages, metrics = safeAreaMetrics }: RenderWithSafeAreaOptions = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider initialMetrics={metrics}>
        <MessagesProvider messages={messages}>{children}</MessagesProvider>
      </SafeAreaProvider>
    ),
  });
}

export function expectNoFreeOrLockedBadges(
  view: Awaited<ReturnType<typeof renderWithSafeArea>>,
): void {
  expect(view.queryAllByText(/^Free$/i)).toHaveLength(0);
  expect(view.queryAllByText(/^Locked$/i)).toHaveLength(0);
}
