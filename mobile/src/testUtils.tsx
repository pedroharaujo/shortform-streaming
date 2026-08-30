import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function renderWithSafeArea(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>
    ),
  });
}

export function expectNoFreeOrLockedBadges(
  view: Awaited<ReturnType<typeof renderWithSafeArea>>,
): void {
  expect(view.queryAllByText(/^Free$/i)).toHaveLength(0);
  expect(view.queryAllByText(/^Locked$/i)).toHaveLength(0);
}
