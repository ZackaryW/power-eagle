import { afterEach, describe, expect, it, vi } from 'vitest';
import { DISMISSED_SEEDED_PLUGINS_KEY, seedLocalBucketOnce } from '../app/host-data';
import type { HostBucketRecord, InstalledPluginRecord } from '../app/host-types';

/**
 * Restore globals after each host-data test.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('host-data local bucket seeding', () => {
  it('does not reseed dismissed local bundled plugins into the local bucket or installed list', () => {
    const storage = new Map<string, string>([
      [DISMISSED_SEEDED_PLUGINS_KEY, JSON.stringify(['file-creator'])],
    ]);

    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: localStorageMock },
      configurable: true,
    });

    let bucketRecords: HostBucketRecord[] = [];
    let installedPlugins: InstalledPluginRecord[] = [];

    seedLocalBucketOnce(
      (next) => {
        bucketRecords = typeof next === 'function' ? next(bucketRecords) : next;
      },
      (next) => {
        installedPlugins = typeof next === 'function' ? next(installedPlugins) : next;
      },
    );

    expect(bucketRecords).toHaveLength(1);
    expect(bucketRecords[0].id).toBe('local');
    expect(bucketRecords[0].plugins.map((plugin) => plugin.id)).toEqual(['recent-libraries']);
    expect(installedPlugins.map((plugin) => plugin.id)).toEqual(['recent-libraries']);
  });
});