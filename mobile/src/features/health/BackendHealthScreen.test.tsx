import { render, userEvent, waitFor } from '@testing-library/react-native';

import type { BackendHealthSnapshot, HealthClient, HealthProbeName } from '../../api/health/types';
import type { ApiConfiguration } from '../../config/environment';
import { BackendHealthScreen } from './BackendHealthScreen';

const configuration: ApiConfiguration = {
  environment: 'local',
  baseUrl: 'http://10.0.2.2:8000',
  catalogTerritory: 'FR',
};

function stubClient(snapshot: BackendHealthSnapshot, onProbeAll?: () => void): HealthClient {
  return {
    probe: async (name: HealthProbeName) =>
      name === 'liveness' ? snapshot.liveness : snapshot.readiness,
    probeAll: async () => {
      onProbeAll?.();
      return snapshot;
    },
  };
}

const reachable: BackendHealthSnapshot = {
  liveness: { outcome: 'available', probe: 'liveness', status: 'ok' },
  readiness: { outcome: 'available', probe: 'readiness', status: 'ok' },
};

describe('BackendHealthScreen', () => {
  it('reports a reachable backend and re-probes when asked again', async () => {
    let probeCount = 0;
    const client = stubClient(reachable, () => {
      probeCount += 1;
    });

    const view = await render(
      <BackendHealthScreen client={client} configuration={configuration} />,
    );
    await waitFor(() => {
      expect(view.getByTestId('health-liveness')).toHaveTextContent('reachable (ok)');
    });
    expect(view.getByTestId('health-readiness')).toHaveTextContent('reachable (ok)');
    expect(view.queryByTestId('health-loading')).toBeNull();
    expect(probeCount).toBe(1);

    await userEvent.setup().press(view.getByTestId('health-refresh'));

    await waitFor(() => expect(probeCount).toBe(2));
  });
});
