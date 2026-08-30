import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { JSX } from 'react';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

export interface HlsVideoViewProps {
  readonly uri: string;
  readonly testID?: string;
  readonly accessibilityLabel?: string;
  readonly initialPositionSeconds?: number;
  readonly paused?: boolean;
  readonly onEnded?: () => void;
  readonly onPosition?: (seconds: number) => void;
  readonly onPlayingChange?: (playing: boolean) => void;
}

export function HlsVideoView({
  uri,
  testID = 'hls-video',
  accessibilityLabel = 'Episode player',
  initialPositionSeconds = 0,
  paused = false,
  onEnded,
  onPosition,
  onPlayingChange,
}: HlsVideoViewProps): JSX.Element {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 1;
    if (initialPositionSeconds > 0) {
      instance.currentTime = initialPositionSeconds;
    }
    if (!paused) {
      instance.play();
    }
  });

  useEventListener(player, 'playToEnd', () => {
    onEnded?.();
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    onPosition?.(Math.floor(currentTime));
  });
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    onPlayingChange?.(isPlaying);
  });

  useEffect(() => {
    if (paused) {
      player.pause();
      return;
    }
    player.play();
  }, [paused, player]);

  return (
    <VideoView
      accessibilityLabel={accessibilityLabel}
      contentFit="contain"
      nativeControls
      player={player}
      style={styles.video}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  video: { backgroundColor: '#000', flex: 1, width: '100%' },
});
