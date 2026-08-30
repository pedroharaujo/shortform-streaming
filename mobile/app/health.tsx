import { Redirect } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppHealthClient } from '../src/api/createAppClients';
import { getApiConfiguration } from '../src/config/appConfiguration';
import { BackendHealthScreen } from '../src/features/health/BackendHealthScreen';

export default function HealthRoute(): JSX.Element {
  const configuration = useMemo(() => getApiConfiguration(), []);
  const client = useMemo(() => createAppHealthClient(), []);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <BackendHealthScreen client={client} configuration={configuration} />;
}
