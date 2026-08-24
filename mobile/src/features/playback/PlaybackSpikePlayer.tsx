import { useVideoPlayer, VideoView } from 'expo-video';
import type { JSX } from 'react';
import { StyleSheet } from 'react-native';

export interface PlaybackSpikePlayerProps {
  readonly uri: string;
}

export function PlaybackSpikePlayer({ uri }: PlaybackSpikePlayerProps): JSX.Element {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.play();
  });

  return (
    <VideoView
      contentFit="contain"
      nativeControls
      player={player}
      style={styles.video}
      testID="playback-spike-video"
    />
  );
}

const styles = StyleSheet.create({
  video: { backgroundColor: '#000', flex: 1, width: '100%' },
});
