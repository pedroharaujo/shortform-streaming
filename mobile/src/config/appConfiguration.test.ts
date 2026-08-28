import { readApiConfiguration } from './appConfiguration';

describe('readApiConfiguration', () => {
  it('reads the configuration frozen into the Expo manifest', () => {
    expect(
      readApiConfiguration({
        api: { environment: 'local', baseUrl: 'http://10.0.2.2:8000', catalogTerritory: 'FR' },
      }),
    ).toEqual({ environment: 'local', baseUrl: 'http://10.0.2.2:8000', catalogTerritory: 'FR' });
  });
});
