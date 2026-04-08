import { fileCreatorParsedPackage } from '../fixtures/file-creator/package';
import { recentLibrariesParsedPackage } from '../fixtures/recent-libraries/package';
import type { BucketPluginRecord, HostBucketRecord, InstalledPluginRecord } from './host-types';
import {
  addBucketFromGitUrl,
  isHostInstallStoreAvailable,
  installLocalPluginFromHost,
  loadBucketRecordsFromHost,
  loadInstalledPluginsFromHost,
  removeLocalPluginFromHost,
  saveBucketRecordsToHost,
  saveInstalledPluginsToHost,
  seedFileCreatorIntoLocalBucket,
  seedRecentLibrariesIntoLocalBucket,
  syncBucketFromHost,
} from './install-store';
import { deriveBucketDirectoryName } from './utils/git';

export const BUCKETS_STORAGE_KEY = 'peagle.host.buckets.v2';
export const INSTALLED_STORAGE_KEY = 'peagle.host.installed.v2';
export const LOCAL_BUCKET_SEED_KEY = 'peagle.host.seed.local-fixtures.v2';
export const DISMISSED_SEEDED_PLUGINS_KEY = 'peagle.host.dismissed-seeded.v1';

/**
 * Load persisted bucket records or fall back to the static bucket catalog.
 */
export function loadBucketRecords(): HostBucketRecord[] {
  if (isHostInstallStoreAvailable()) {
    const hostRecords = loadBucketRecordsFromHost();
    return hostRecords ?? [];
  }

  const stored = readJsonStorage<HostBucketRecord[]>(BUCKETS_STORAGE_KEY);
  return stored ?? [];
}

/**
 * Load persisted installed plugins or start from an empty installed set.
 */
export function loadInstalledPlugins(): InstalledPluginRecord[] {
  if (isHostInstallStoreAvailable()) {
    const hostRecords = loadInstalledPluginsFromHost();
    return hostRecords ?? [];
  }

  const stored = readJsonStorage<InstalledPluginRecord[]>(INSTALLED_STORAGE_KEY);
  return stored ?? [];
}

/**
 * Read one JSON storage value safely.
 */
export function readJsonStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Save one JSON storage value safely.
 */
export function saveJsonStorage(key: string, value: unknown): void {
  if (isHostInstallStoreAvailable()) {
    if (key === BUCKETS_STORAGE_KEY) {
      saveBucketRecordsToHost(value as HostBucketRecord[]);
      return;
    }

    if (key === INSTALLED_STORAGE_KEY) {
      saveInstalledPluginsToHost(value as InstalledPluginRecord[]);
      return;
    }
  }

  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Seed the local bucket with recent-libraries once and persist the result.
 */
export function seedLocalBucketOnce(
  setBucketRecords: React.Dispatch<React.SetStateAction<HostBucketRecord[]>>,
  setInstalledPlugins: React.Dispatch<React.SetStateAction<InstalledPluginRecord[]>>,
): void {
  const localPlugins = [buildRecentLibrariesPlugin(), buildFileCreatorPlugin()];
  const dismissedSeededPlugins = readDismissedSeededPlugins();
  const visibleSeededPlugins = localPlugins.filter((plugin) => !dismissedSeededPlugins.includes(plugin.id));

  if (isHostInstallStoreAvailable()) {
    for (const localPlugin of visibleSeededPlugins) {
      if (localPlugin.id === 'recent-libraries') {
        seedRecentLibrariesIntoLocalBucket(localPlugin);
      }

      if (localPlugin.id === 'file-creator') {
        seedFileCreatorIntoLocalBucket(localPlugin);
      }
    }

    const hostBuckets = loadBucketRecordsFromHost();
    const hostInstalled = loadInstalledPluginsFromHost();
    setBucketRecords(() => hostBuckets ?? ensureLocalBucketSeeds([], visibleSeededPlugins));
    setInstalledPlugins(() => mergeInstalledWithSeeded(hostInstalled ?? [], visibleSeededPlugins, dismissedSeededPlugins));
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  if (window.localStorage.getItem(LOCAL_BUCKET_SEED_KEY)) {
    return;
  }

  setBucketRecords((current) => ensureLocalBucketSeeds(current, visibleSeededPlugins));
  setInstalledPlugins((current) => mergeInstalledWithSeeded(current, visibleSeededPlugins, dismissedSeededPlugins));
  window.localStorage.setItem(LOCAL_BUCKET_SEED_KEY, '1');
}

/**
 * Ensure the local bucket carries the seeded bundled plugins.
 */
export function ensureLocalBucketSeeds(current: HostBucketRecord[], localPlugins: BucketPluginRecord[]): HostBucketRecord[] {
  if (!current.length) {
    return [buildLocalBucket(localPlugins)];
  }

  const hasLocalBucket = current.some((bucket) => bucket.id === 'local');
  if (!hasLocalBucket) {
    return [buildLocalBucket(localPlugins), ...current];
  }

  return current.map((bucket) => {
    if (bucket.id !== 'local') {
      return bucket;
    }

    const missingPlugins = localPlugins.filter((localPlugin) => !bucket.plugins.some((plugin) => plugin.id === localPlugin.id));
    return missingPlugins.length ? { ...bucket, plugins: [...missingPlugins, ...bucket.plugins] } : bucket;
  });
}

/**
 * Match one installed plugin against the sidebar filter.
 */
export function matchesInstalledFilter(plugin: InstalledPluginRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return plugin.name.toLowerCase().includes(normalized)
    || plugin.id.toLowerCase().includes(normalized)
    || plugin.keywords.some((keyword) => keyword.toLowerCase().includes(normalized));
}

/**
 * Build the local bucket entry for the real recent-libraries package.
 */
export function buildRecentLibrariesPlugin(): BucketPluginRecord {
  const manifestKeywords = Array.isArray(recentLibrariesParsedPackage.manifest.keywords)
    ? recentLibrariesParsedPackage.manifest.keywords
    : [];

  return {
    id: recentLibrariesParsedPackage.manifest.id,
    name: recentLibrariesParsedPackage.manifest.name,
    version: recentLibrariesParsedPackage.manifest.version,
    type: recentLibrariesParsedPackage.manifest.type,
    keywords: manifestKeywords,
    description: 'Browse and manage Eagle library history through the v2 runtime.',
  };
}

/**
 * Build the local bucket entry for the bundled file-creator package.
 */
export function buildFileCreatorPlugin(): BucketPluginRecord {
  const manifestKeywords = Array.isArray(fileCreatorParsedPackage.manifest.keywords)
    ? fileCreatorParsedPackage.manifest.keywords
    : [];

  return {
    id: fileCreatorParsedPackage.manifest.id,
    name: fileCreatorParsedPackage.manifest.name,
    version: fileCreatorParsedPackage.manifest.version,
    type: fileCreatorParsedPackage.manifest.type,
    keywords: manifestKeywords,
    description: fileCreatorParsedPackage.manifest.description ?? 'Create files with custom extensions.',
  };
}

/**
 * Build the persistent local bucket wrapper.
 */
export function buildLocalBucket(localPlugins: BucketPluginRecord[]): HostBucketRecord {
  return {
    id: 'local',
    name: 'local',
    url: 'local://power-eagle',
    branch: 'workspace',
    lastSync: todayStamp(),
    status: 'ok',
    isLocal: true,
    plugins: localPlugins,
  };
}

/**
 * Merge seeded plugin records into the installed list without replacing existing ids.
 */
function mergeInstalledWithSeeded(
  current: InstalledPluginRecord[],
  localPlugins: BucketPluginRecord[],
  dismissedSeededPlugins: string[],
): InstalledPluginRecord[] {
  let nextInstalled = [...current];

  for (const localPlugin of localPlugins) {
    if (dismissedSeededPlugins.includes(localPlugin.id)) {
      continue;
    }

    if (nextInstalled.some((plugin) => plugin.id === localPlugin.id)) {
      continue;
    }

    nextInstalled = [...nextInstalled, toInstalledPluginRecord(localPlugin, 'local', 'local')];
  }

  return nextInstalled;
}

/**
 * Remember that one seeded plugin was explicitly removed by the user.
 */
export function dismissSeededPlugin(pluginId: string): void {
  const currentDismissed = new Set(readDismissedSeededPlugins());
  currentDismissed.add(pluginId);
  writeDismissedSeededPlugins(Array.from(currentDismissed));
}

/**
 * Clear the dismissed state when a user explicitly reinstalls a plugin.
 */
export function restoreDismissedSeededPlugin(pluginId: string): void {
  const currentDismissed = readDismissedSeededPlugins().filter((dismissedId) => dismissedId !== pluginId);
  writeDismissedSeededPlugins(currentDismissed);
}

/**
 * Remove one local-bucket plugin from the host store so both the disk package and bucket index disappear.
 */
export function removeLocalBucketPlugin(pluginId: string): boolean {
  return removeLocalPluginFromHost(pluginId);
}

/**
 * Read the list of seeded plugin ids the user explicitly removed.
 */
function readDismissedSeededPlugins(): string[] {
  const stored = readJsonStorage<string[]>(DISMISSED_SEEDED_PLUGINS_KEY);
  return Array.isArray(stored) ? stored : [];
}

/**
 * Persist the list of dismissed seeded plugin ids.
 */
function writeDismissedSeededPlugins(pluginIds: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DISMISSED_SEEDED_PLUGINS_KEY, JSON.stringify(pluginIds));
}
/**
 * Convert one bucket plugin into an installed plugin record.
 */
export function toInstalledPluginRecord(
  plugin: BucketPluginRecord,
  bucketId: string | null,
  source: InstalledPluginRecord['source'],
): InstalledPluginRecord {
  return {
    ...plugin,
    enabled: true,
    source,
    bucketId,
  };
}

/**
 * Build one bucket record from a user-provided URL.
 */
export function createBucketFromUrl(url: string): HostBucketRecord {
  if (isHostInstallStoreAvailable()) {
    const hostBucket = addBucketFromGitUrl(url);
    if (hostBucket) {
      return hostBucket;
    }
  }

  const parts = url.split('/').filter(Boolean);
  const bucketId = parts.length ? parts[parts.length - 1] : `bucket-${Date.now()}`;
  return {
    id: bucketId,
    name: bucketId,
    url,
    branch: 'main',
    lastSync: 'never',
    status: 'ok',
    plugins: [],
  };
}

/**
 * Sync one bucket and return the refreshed record when host storage is available.
 */
export function refreshBucketRecord(bucketId: string): HostBucketRecord | null {
  if (!isHostInstallStoreAvailable()) {
    return null;
  }

  return syncBucketFromHost(bucketId);
}

/**
 * Build the normalized bucket id that matches the git-backed folder name.
 */
export function createBucketIdFromUrl(url: string): string {
  return deriveBucketDirectoryName(url);
}

/**
 * Build one installed plugin placeholder from a direct URL.
 */
export function createInstalledPluginFromUrl(url: string): InstalledPluginRecord {
  const pluginId = createUrlPluginId(url);
  return {
    id: pluginId,
    name: 'Local URL Plugin',
    version: '1.0.0',
    type: 'button',
    keywords: ['local', 'url'],
    description: 'Installed from a direct URL placeholder flow.',
    enabled: true,
    source: 'url',
    bucketId: null,
    url,
  };
}

/**
 * Install one local plugin folder into the local bucket and return its installed record.
 */
export function createInstalledPluginFromLocalPath(sourcePath: string): InstalledPluginRecord | null {
  if (!isHostInstallStoreAvailable()) {
    return null;
  }

  const localPlugin = installLocalPluginFromHost(sourcePath);
  if (!localPlugin) {
    return null;
  }

  return toInstalledPluginRecord(localPlugin, 'local', 'local');
}

/**
 * Open the host folder picker for one local plugin directory when available.
 */
export async function pickLocalPluginDirectory(): Promise<string | null> {
  if (typeof eagle === 'undefined' || !eagle.dialog?.showOpenDialog) {
    return null;
  }

  const result = await eagle.dialog.showOpenDialog({
    title: 'Select Plugin Folder',
    buttonLabel: 'Install Plugin',
    properties: ['openDirectory'],
  });

  return result.canceled ? null : result.filePaths[0] ?? null;
}

/**
 * Derive one stable plugin id from a direct URL string.
 */
export function createUrlPluginId(url: string): string {
  const urlParts = url.split('/').filter(Boolean);
  const normalized = urlParts.length ? urlParts[urlParts.length - 1] : `plugin-${Date.now()}`;
  return normalized.replace(/\.[^.]+$/u, '').replace(/[^a-zA-Z0-9-_]+/gu, '-').toLowerCase();
}

/**
 * Format the current day as a compact YYYY-MM-DD stamp.
 */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}