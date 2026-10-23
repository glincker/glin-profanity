import { clearFilterPool, createFilterConfig, getPooledFilter } from '../src/core/filterPool';

describe('filterPool', () => {
  afterEach(() => {
    clearFilterPool();
  });

  test('reuses the same Filter instance for identical config', () => {
    const config = { languages: ['english'] as ('english')[] };
    const first = getPooledFilter(config);
    const second = getPooledFilter(config);
    expect(second).toBe(first);
  });

  test('creates separate instances for different configs', () => {
    const english = getPooledFilter({ languages: ['english'] });
    const spanish = getPooledFilter({ languages: ['spanish'] });
    expect(spanish).not.toBe(english);
  });

  test('object field order does not affect pool key', () => {
    const first = getPooledFilter({
      languages: ['english'],
      customWords: ['word1'],
    });
    const second = getPooledFilter({
      customWords: ['word1'],
      languages: ['english'],
    });
    expect(second).toBe(first);
  });

  test('pre-merged config shares the same pool instance', () => {
    const raw = getPooledFilter({
      languages: ['english'],
      ignoreWords: ['customword'],
    });
    const premerged = getPooledFilter(
      createFilterConfig({
        languages: ['english'],
        ignoreWords: ['customword'],
      }),
    );
    expect(premerged).toBe(raw);
  });

  test('createFilterConfig is idempotent', () => {
    const once = createFilterConfig({ ignoreWords: ['customword'] });
    const twice = createFilterConfig(once);
    expect(twice.ignoreWords).toEqual(once.ignoreWords);
  });

  test('getPooledFilter merges global whitelist on raw config', () => {
    const filter = getPooledFilter({ languages: ['english'] });
    // "Class" is in globalWhitelist.json and should not flag alone as profane
    // when passed through the merged config path.
    expect(filter.isProfane('Class')).toBe(false);
  });
});
