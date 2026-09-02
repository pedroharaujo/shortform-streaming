import {
  API_BASE_URL_VARIABLE,
  API_ENVIRONMENT_VARIABLE,
  EnvironmentConfigurationError,
  resolveApiConfiguration,
} from './environment';

const localEnvironment = {
  [API_ENVIRONMENT_VARIABLE]: 'local',
  [API_BASE_URL_VARIABLE]: 'http://10.0.2.2:8000',
};

describe('resolveApiConfiguration', () => {
  it('resolves the explicit API environment without market configuration', () => {
    expect(resolveApiConfiguration(localEnvironment)).toEqual({
      environment: 'local',
      baseUrl: 'http://10.0.2.2:8000',
    });
  });

  it('fails when the environment name is absent instead of defaulting', () => {
    expect(() =>
      resolveApiConfiguration({ [API_BASE_URL_VARIABLE]: 'https://api.example' }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it('rejects cleartext http outside the local environment', () => {
    expect(() =>
      resolveApiConfiguration({
        [API_ENVIRONMENT_VARIABLE]: 'production',
        [API_BASE_URL_VARIABLE]: 'http://api.example',
      }),
    ).toThrow(/must use https/);
  });

  it('ignores locale because the MVP market and language are server-owned constants', () => {
    expect(resolveApiConfiguration({ ...localEnvironment, LANG: 'de_DE.UTF-8' })).toEqual({
      environment: 'local',
      baseUrl: 'http://10.0.2.2:8000',
    });
  });

  it('refuses to build when a secret-shaped EXPO_PUBLIC_ variable is present', () => {
    expect(() =>
      resolveApiConfiguration({ ...localEnvironment, EXPO_PUBLIC_API_TOKEN: 'nope' }),
    ).toThrow(/would be embedded in the public JavaScript bundle/);
  });
});
