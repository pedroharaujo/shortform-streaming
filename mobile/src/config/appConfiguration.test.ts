import { readApiConfiguration } from './appConfiguration';
import { EnvironmentConfigurationError } from './environment';

describe('readApiConfiguration', () => {
  it('reads the configuration frozen into the Expo manifest', () => {
    expect(
      readApiConfiguration({ api: { environment: 'local', baseUrl: 'http://10.0.2.2:8000' } }),
    ).toEqual({ environment: 'local', baseUrl: 'http://10.0.2.2:8000' });
  });

  it('fails when the manifest has no api section', () => {
    expect(() => readApiConfiguration({})).toThrow(EnvironmentConfigurationError);
  });

  it('fails when extra is missing entirely', () => {
    expect(() => readApiConfiguration(undefined)).toThrow(/missing extra.api/);
  });

  it('fails on an unknown environment name', () => {
    expect(() =>
      readApiConfiguration({ api: { environment: 'dev', baseUrl: 'https://api.example' } }),
    ).toThrow(/extra.api.environment/);
  });

  it('fails on an empty base URL', () => {
    expect(() => readApiConfiguration({ api: { environment: 'local', baseUrl: '' } })).toThrow(
      /extra.api.baseUrl/,
    );
  });
});
