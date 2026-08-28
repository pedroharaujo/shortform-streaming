import { getOrCreateDeviceId } from './deviceId';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
}));

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('creates a UUID once and reuses the stored value', async () => {
    const first = await getOrCreateDeviceId();
    const second = await getOrCreateDeviceId();
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second).toBe(first);
    expect(first).not.toMatch(/usr_|firebase|EXPO_PUBLIC/i);
  });
});
