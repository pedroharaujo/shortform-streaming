import {
  API_BASE_URL_VARIABLE,
  API_ENVIRONMENT_VARIABLE,
  CATALOG_TERRITORY_VARIABLE,
  EnvironmentConfigurationError,
  resolveApiConfiguration,
} from './environment';

const localEnvironment = {
  [API_ENVIRONMENT_VARIABLE]: 'local',
  [API_BASE_URL_VARIABLE]: 'http://10.0.2.2:8000',
  [CATALOG_TERRITORY_VARIABLE]: 'FR',
};

describe('resolveApiConfiguration', () => {
  it('resolves an explicit local configuration', () => {
    expect(resolveApiConfiguration(localEnvironment)).toEqual({
      environment: 'local',
      baseUrl: 'http://10.0.2.2:8000',
      catalogTerritory: 'FR',
    });
  });

  it('fails when the environment name is absent instead of defaulting', () => {
    expect(() =>
      resolveApiConfiguration({
        [API_BASE_URL_VARIABLE]: 'https://api.example',
        [CATALOG_TERRITORY_VARIABLE]: 'FR',
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it('rejects cleartext http outside the local environment', () => {
    expect(() =>
      resolveApiConfiguration({
        [API_ENVIRONMENT_VARIABLE]: 'production',
        [API_BASE_URL_VARIABLE]: 'http://api.example',
        [CATALOG_TERRITORY_VARIABLE]: 'FR',
      }),
    ).toThrow(/must use https/);
  });

  it('fails when the catalog territory is absent instead of inferring locale', () => {
    expect(() =>
      resolveApiConfiguration({
        [API_ENVIRONMENT_VARIABLE]: 'local',
        [API_BASE_URL_VARIABLE]: 'http://10.0.2.2:8000',
        LANG: 'fr_FR.UTF-8',
        LC_ALL: 'fr_FR.UTF-8',
        LOCALE: 'fr_FR',
      }),
    ).toThrow(new RegExp(CATALOG_TERRITORY_VARIABLE));
  });

  it('does not take catalog territory from locale-shaped environment variables', () => {
    expect(
      resolveApiConfiguration({
        ...localEnvironment,
        LANG: 'de_DE.UTF-8',
        LC_ALL: 'de_DE.UTF-8',
        LOCALE: 'DE',
      }),
    ).toEqual({
      environment: 'local',
      baseUrl: 'http://10.0.2.2:8000',
      catalogTerritory: 'FR',
    });
  });

  it('refuses to build when a secret-shaped EXPO_PUBLIC_ variable is present', () => {
    expect(() =>
      resolveApiConfiguration({ ...localEnvironment, EXPO_PUBLIC_API_TOKEN: 'nope' }),
    ).toThrow(/would be embedded in the public JavaScript bundle/);
  });
});
