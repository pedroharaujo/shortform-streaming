import type { JSX } from 'react';
import { Pressable, Text, View } from 'react-native';

export function HlsVideoView({
  onEnded,
  onPosition,
  initialPositionSeconds,
  testID,
}: {
  readonly onEnded?: () => void;
  readonly onPosition?: (seconds: number) => void;
  readonly initialPositionSeconds?: number;
  readonly testID?: string;
}): JSX.Element {
  const resumeSeconds = initialPositionSeconds ?? 0;
  return (
    <View testID={testID ?? 'player-video'}>
      <Text testID="player-initial-position">{String(resumeSeconds)}</Text>
      <Pressable onPress={() => onPosition?.(86)} testID="player-simulate-near-complete">
        <Text>Simulate near complete</Text>
      </Pressable>
      <Pressable onPress={() => onEnded?.()} testID="player-simulate-end">
        <Text>Simulate end</Text>
      </Pressable>
    </View>
  );
}
