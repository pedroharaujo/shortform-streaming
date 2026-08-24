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
  it('shows the selected environment and target base URL', async () => {
    const view = await render(
      <BackendHealthScreen client={stubClient(reachable)} configuration={configuration} />,
    );

    expect(view.getByTestId('health-target')).toHaveTextContent('local · http://10.0.2.2:8000');
  });

  it('shows a loading state before the first probe resolves', async () => {
    const pending: HealthClient = {
      probe: () => new Promise(() => {}),
      probeAll: () => new Promise(() => {}),
    };

    const view = await render(
      <BackendHealthScreen client={pending} configuration={configuration} />,
    );

    expect(view.getByTestId('health-loading')).toBeTruthy();
    expect(view.queryByTestId('health-liveness')).toBeNull();
  });

  it('reports a reachable backend', async () => {
    const view = await render(
      <BackendHealthScreen client={stubClient(reachable)} configuration={configuration} />,
    );

    await waitFor(() => {
      expect(view.getByTestId('health-liveness')).toHaveTextContent('reachable (ok)');
    });
    expect(view.getByTestId('health-readiness')).toHaveTextContent('reachable (ok)');
    expect(view.queryByTestId('health-loading')).toBeNull();
  });

  it('reports an unreachable backend and a database-unavailable readiness probe', async () => {
    const degraded: BackendHealthSnapshot = {
      liveness: { outcome: 'unreachable', probe: 'liveness', reason: 'Network request failed' },
      readiness: {
        outcome: 'unavailable',
        probe: 'readiness',
        httpStatus: 503,
        status: 'unavailable',
      },
    };

    const view = await render(
      <BackendHealthScreen client={stubClient(degraded)} configuration={configuration} />,
    );

    await waitFor(() => {
      expect(view.getByTestId('health-liveness')).toHaveTextContent(
        'unreachable (Network request failed)',
      );
    });
    expect(view.getByTestId('health-readiness')).toHaveTextContent(
      'unavailable (HTTP 503, unavailable)',
    );
  });

  it('re-probes the backend when the user asks again', async () => {
    let probeCount = 0;
    const client = stubClient(reachable, () => {
      probeCount += 1;
    });

    const view = await render(
      <BackendHealthScreen client={client} configuration={configuration} />,
    );
    await waitFor(() => expect(probeCount).toBe(1));

    await userEvent.setup().press(view.getByTestId('health-refresh'));

    await waitFor(() => expect(probeCount).toBe(2));
  });
});
