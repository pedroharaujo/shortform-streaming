import {
  nextOpaqueEpisodeId,
  clampResumePosition,
  shouldSkipProgressPut,
} from './playbackProgress';

describe('playbackProgress', () => {
  it('skips an unchanged progress put', () => {
    expect(
      shouldSkipProgressPut(
        { positionSeconds: 10, completed: false },
        { positionSeconds: 10, completed: false },
      ),
    ).toBe(true);
    expect(
      shouldSkipProgressPut(
        { positionSeconds: 10, completed: false },
        { positionSeconds: 11, completed: false },
      ),
    ).toBe(false);
    expect(shouldSkipProgressPut(null, { positionSeconds: 0, completed: false })).toBe(false);
  });

  it('clamps resume position to the episode duration', () => {
    expect(clampResumePosition(12, 90)).toBe(12);
    expect(clampResumePosition(-4, 90)).toBe(0);
    expect(clampResumePosition(120, 90)).toBe(90);
  });

  it('takes the next opaque id from the series list, not a free-window order filter', () => {
    const next = nextOpaqueEpisodeId(
      [
        {
          number: 1,
          episodes: [
            { id: 'ep_one', order: 1, duration_seconds: 90, title: 'One', synopsis: '' },
            { id: 'ep_five', order: 5, duration_seconds: 90, title: 'Five', synopsis: '' },
            { id: 'ep_six', order: 6, duration_seconds: 90, title: 'Six', synopsis: '' },
          ],
        },
      ],
      'ep_five',
    );
    expect(next).toBe('ep_six');
    expect(next).not.toBe('ep_five');
  });
});
