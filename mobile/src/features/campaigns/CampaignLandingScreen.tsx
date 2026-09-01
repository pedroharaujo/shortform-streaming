import { useEffect, type JSX } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { CatalogClient } from '../../api/catalog/types';

export interface CampaignLandingScreenProps {
  readonly client: CatalogClient;
  readonly seriesId: string;
  readonly onResolve: (seriesId: string | null) => void;
}

export function CampaignLandingScreen({
  client,
  seriesId,
  onResolve,
}: CampaignLandingScreenProps): JSX.Element {
  useEffect(() => {
    if (seriesId === '') {
      onResolve(null);
      return;
    }
    let active = true;
    void client.getSeries(seriesId).then(
      (result) => {
        if (active) onResolve(result.outcome === 'ok' ? result.data.id : null);
      },
      () => {
        if (active) onResolve(null);
      },
    );
    return () => {
      active = false;
    };
  }, [client, onResolve, seriesId]);

  return (
    <View style={styles.container} testID="campaign-landing-loading">
      <ActivityIndicator accessibilityLabel="Opening series" color="#fafafa" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#09090b',
    flex: 1,
    justifyContent: 'center',
  },
});
