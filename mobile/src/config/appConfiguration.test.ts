import { readApiConfiguration } from './appConfiguration';
import { EnvironmentConfigurationError } from './environment';

describe('readApiConfiguration', () => {
  it('reads the configuration frozen into the Expo manifest', () => {
    expect(
      readApiConfiguration({
        api: { environment: 'local', baseUrl: 'http://10.0.2.2:8000', catalogTerritory: 'FR' },
      }),
    ).toEqual({ environment: 'local', baseUrl: 'http://10.0.2.2:8000', catalogTerritory: 'FR' });
  });

  it('fails when the manifest has no api section', () => {
    expect(() => readApiConfiguration({})).toThrow(EnvironmentConfigurationError);
  });

  it('fails when extra is missing entirely', () => {
    expect(() => readApiConfiguration(undefined)).toThrow(/missing extra.api/);
  });

  it('fails on an unknown environment name', () => {
    expect(() =>
      readApiConfiguration({
        api: { environment: 'dev', baseUrl: 'https://api.example', catalogTerritory: 'FR' },
      }),
    ).toThrow(/extra.api.environment/);
  });

  it('fails on an empty base URL', () => {
    expect(() =>
      readApiConfiguration({ api: { environment: 'local', baseUrl: '', catalogTerritory: 'FR' } }),
    ).toThrow(/extra.api.baseUrl/);
  });

  it('fails when catalog territory is missing from the manifest', () => {
    expect(() =>
      readApiConfiguration({ api: { environment: 'local', baseUrl: 'http://10.0.2.2:8000' } }),
    ).toThrow(/extra.api.catalogTerritory/);
  });

  it('fails when catalog territory is not ISO 3166-1 alpha-2', () => {
    expect(() =>
      readApiConfiguration({
        api: { environment: 'local', baseUrl: 'http://10.0.2.2:8000', catalogTerritory: 'FRA' },
      }),
    ).toThrow(/extra.api.catalogTerritory/);
  });
});
