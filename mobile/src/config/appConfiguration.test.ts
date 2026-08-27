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
});
