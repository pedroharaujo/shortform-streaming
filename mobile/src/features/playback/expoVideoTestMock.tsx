import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import { Text, View } from 'react-native';

export function VideoView({
  testID,
  player,
}: {
  testID?: string;
  player?: { uri?: string };
  children?: ReactNode;
}): ReactElement {
  return createElement(
    View,
    { testID: testID ?? 'playback-spike-video' },
    createElement(Text, { testID: 'playback-spike-video-uri' }, player?.uri ?? ''),
  );
}

export function useVideoPlayer(
  source: string,
  setup?: (player: { uri: string; play: () => void }) => void,
): { uri: string; play: () => void } {
  const player = { uri: source, play: jest.fn() };
  setup?.(player);
  return player;
}
