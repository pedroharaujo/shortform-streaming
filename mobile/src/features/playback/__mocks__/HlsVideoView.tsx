import type { JSX } from 'react';
import { Pressable, Text, View } from 'react-native';

export function HlsVideoView({
  onEnded,
  testID,
}: {
  readonly onEnded?: () => void;
  readonly testID?: string;
}): JSX.Element {
  return (
    <View testID={testID ?? 'player-video'}>
      <Pressable onPress={() => onEnded?.()} testID="player-simulate-end">
        <Text>Simulate end</Text>
      </Pressable>
    </View>
  );
}
