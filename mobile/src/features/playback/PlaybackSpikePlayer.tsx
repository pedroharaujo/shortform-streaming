import type { JSX } from 'react';

import { HlsVideoView } from './HlsVideoView';

export interface PlaybackSpikePlayerProps {
  readonly uri: string;
}

export function PlaybackSpikePlayer({ uri }: PlaybackSpikePlayerProps): JSX.Element {
  return <HlsVideoView testID="playback-spike-video" uri={uri} />;
}
