import type { JSX } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { HealthClient, HealthProbeResult } from '../../api/health/types';
import type { ApiConfiguration } from '../../config/environment';
import { useBackendHealth } from './useBackendHealth';

export interface BackendHealthScreenProps {
  readonly client: HealthClient;
  readonly configuration: ApiConfiguration;
}

function describe(result: HealthProbeResult): string {
  switch (result.outcome) {
    case 'available':
      return `reachable (${result.status})`;
    case 'unavailable':
      return `unavailable (HTTP ${result.httpStatus}, ${result.status})`;
    case 'unreachable':
      return `unreachable (${result.reason})`;
  }
}

function ProbeRow({ label, result }: { label: string; result: HealthProbeResult }): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text accessibilityRole="text" testID={`health-${result.probe}`} style={styles.rowValue}>
        {describe(result)}
      </Text>
    </View>
  );
}

export function BackendHealthScreen({
  client,
  configuration,
}: BackendHealthScreenProps): JSX.Element {
  const { state, refresh } = useBackendHealth(client);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Backend availability</Text>
      <Text style={styles.subtitle} testID="health-target">
        {configuration.environment} · {configuration.baseUrl}
      </Text>

      {state.phase === 'loading' ? (
        <View style={styles.loading} testID="health-loading">
          <ActivityIndicator accessibilityLabel="Checking backend availability" />
          <Text style={styles.rowValue}>Checking backend availability…</Text>
        </View>
      ) : (
        <View style={styles.results}>
          <ProbeRow label="Liveness" result={state.snapshot.liveness} />
          <ProbeRow label="Readiness" result={state.snapshot.readiness} />
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={refresh}
        style={styles.button}
        testID="health-refresh"
      >
        <Text style={styles.buttonLabel}>Check again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderColor: '#3f3f46',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonLabel: { color: '#fafafa', fontSize: 16 },
  container: {
    alignItems: 'center',
    backgroundColor: '#09090b',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loading: { alignItems: 'center', gap: 12 },
  results: { gap: 8, width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: '#a1a1aa', fontSize: 16 },
  rowValue: { color: '#fafafa', fontSize: 16 },
  subtitle: { color: '#a1a1aa', fontSize: 14, marginBottom: 24 },
  title: { color: '#fafafa', fontSize: 22, fontWeight: '600', marginBottom: 4 },
});
