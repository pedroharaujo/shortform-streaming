import { Redirect } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createHealthClient } from '../src/api/health/healthClient';
import { getApiConfiguration } from '../src/config/appConfiguration';
import { BackendHealthScreen } from '../src/features/health/BackendHealthScreen';

export default function HealthRoute(): JSX.Element {
  const configuration = useMemo(() => getApiConfiguration(), []);
  const client = useMemo(
    () => createHealthClient({ baseUrl: configuration.baseUrl }),
    [configuration.baseUrl],
  );

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <BackendHealthScreen client={client} configuration={configuration} />;
}
