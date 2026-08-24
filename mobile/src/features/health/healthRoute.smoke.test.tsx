import { render, waitFor } from '@testing-library/react-native';

import type { BackendHealthSnapshot, HealthClient, HealthProbeName } from '../../api/health/types';
import type { ApiConfiguration } from '../../config/environment';
import { BackendHealthScreen } from './BackendHealthScreen';

const configuration: ApiConfiguration = {
  environment: 'local',
  baseUrl: 'http://10.0.2.2:8000',
  catalogTerritory: 'FR',
};

const reachable: BackendHealthSnapshot = {
  liveness: { outcome: 'available', probe: 'liveness', status: 'ok' },
  readiness: { outcome: 'available', probe: 'readiness', status: 'ok' },
};

function stubClient(snapshot: BackendHealthSnapshot): HealthClient {
  return {
    probe: async (name: HealthProbeName) =>
      name === 'liveness' ? snapshot.liveness : snapshot.readiness,
    probeAll: async () => snapshot,
  };
}

describe('health route smoke', () => {
  it('still renders the backend availability screen', async () => {
    const view = await render(
      <BackendHealthScreen client={stubClient(reachable)} configuration={configuration} />,
    );

    expect(view.getByText('Backend availability')).toBeTruthy();
    await waitFor(() => {
      expect(view.getByTestId('health-liveness')).toHaveTextContent('reachable (ok)');
    });
  });
});
