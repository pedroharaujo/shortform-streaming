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
  it('resolves an explicit local configuration', () => {
    expect(resolveApiConfiguration(localEnvironment)).toEqual({
      environment: 'local',
      baseUrl: 'http://10.0.2.2:8000',
    });
  });

  it('trims surrounding whitespace and strips trailing slashes', () => {
    expect(
      resolveApiConfiguration({
        [API_ENVIRONMENT_VARIABLE]: ' staging ',
        [API_BASE_URL_VARIABLE]: ' https://api.staging.example/ ',
      }),
    ).toEqual({ environment: 'staging', baseUrl: 'https://api.staging.example' });
  });

  it('fails when the environment name is absent instead of defaulting', () => {
    expect(() =>
      resolveApiConfiguration({ [API_BASE_URL_VARIABLE]: 'https://api.example' }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it('fails when the environment name is blank', () => {
    expect(() =>
      resolveApiConfiguration({ ...localEnvironment, [API_ENVIRONMENT_VARIABLE]: '   ' }),
    ).toThrow(/is required/);
  });

  it('fails when the base URL is absent', () => {
    expect(() => resolveApiConfiguration({ [API_ENVIRONMENT_VARIABLE]: 'local' })).toThrow(
      new RegExp(API_BASE_URL_VARIABLE),
    );
  });

  it('rejects an unknown environment name', () => {
    expect(() =>
      resolveApiConfiguration({ ...localEnvironment, [API_ENVIRONMENT_VARIABLE]: 'prod' }),
    ).toThrow(/must be one of local, staging, production/);
  });

  it('rejects a relative base URL', () => {
    expect(() =>
      resolveApiConfiguration({ ...localEnvironment, [API_BASE_URL_VARIABLE]: '/health' }),
    ).toThrow(/must be an absolute URL/);
  });

  it('rejects a non-http scheme', () => {
    expect(() =>
      resolveApiConfiguration({
        ...localEnvironment,
        [API_BASE_URL_VARIABLE]: 'ftp://example.com',
      }),
    ).toThrow(/must use http or https/);
  });

  it('rejects cleartext http outside the local environment', () => {
    expect(() =>
      resolveApiConfiguration({
        [API_ENVIRONMENT_VARIABLE]: 'production',
        [API_BASE_URL_VARIABLE]: 'http://api.example',
      }),
    ).toThrow(/must use https/);
  });

  it('rejects a base URL carrying a query string', () => {
    expect(() =>
      resolveApiConfiguration({
        ...localEnvironment,
        [API_BASE_URL_VARIABLE]: 'http://10.0.2.2:8000?debug=1',
      }),
    ).toThrow(/query string or fragment/);
  });

  it('rejects credentials embedded in the base URL', () => {
    expect(() =>
      resolveApiConfiguration({
        ...localEnvironment,
        [API_BASE_URL_VARIABLE]: 'http://someone:hunter2@10.0.2.2:8000',
      }),
    ).toThrow(/must not embed credentials/);
  });

  it('refuses to build when a secret-shaped EXPO_PUBLIC_ variable is present', () => {
    expect(() =>
      resolveApiConfiguration({ ...localEnvironment, EXPO_PUBLIC_API_TOKEN: 'nope' }),
    ).toThrow(/would be embedded in the public JavaScript bundle/);
  });

  it('ignores non-public variables that mention secrets', () => {
    expect(() =>
      resolveApiConfiguration({ ...localEnvironment, DJANGO_SECRET_KEY: 'nope' }),
    ).not.toThrow();
  });
});
