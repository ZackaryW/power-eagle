import type { BucketPluginRecord, HostBucketRecord, InstalledPluginRecord } from './host-types';
import { FILE_CREATOR_SEED_FILES, RECENT_LIBRARIES_SEED_FILES } from './seeds';
import { cloneGitRepository, deriveBucketDirectoryName, isGitRuntimeAvailable, pullGitRepository } from './utils/git';

interface PowerEaglePaths {
  baseDir: string;
  bucketsDir: string;
  localBucketDir: string;
  localBucketPluginsDir: string;
  downloadDir: string;
  cacheDir: string;
  installedStateFile: string;
  localBucketManifestFile: string;
}

type RuntimeRequire = ((moduleName: string) => unknown) | null;

/**
 * Check whether the current runtime can use Node file system APIs.
 */
export function isHostInstallStoreAvailable(): boolean {
  return getRuntimeRequire() !== null;
}

/**
 * Clone one remote bucket into ~/.powereagle/buckets and return the refreshed bucket record.
 */
export function addBucketFromGitUrl(url: string): HostBucketRecord | null {
  const fs = getRuntimeFs();
  const pathModule = getRuntimePath();
  const paths = getPowerEaglePaths();
  if (!fs || !pathModule || !paths || !isGitRuntimeAvailable()) {
    return null;
  }

  ensurePowerEagleLayoutSync(fs, paths);

  const bucketId = deriveBucketDirectoryName(url);
  const bucketDir = pathModule.join(paths.bucketsDir, bucketId);

  if (!fs.existsSync(bucketDir)) {
    const cloneResult = cloneGitRepository(url, bucketDir);
    if (!cloneResult.ok) {
      return null;
    }
  }

  ensureBucketManifestSync(fs, pathModule, bucketDir, bucketId, url);
  return readBucketRecordSync(fs, pathModule, paths, bucketId);
}

/**
 * Pull the latest git state for one bucket and refresh its plugin metadata.
 */
export function syncBucketFromHost(bucketId: string): HostBucketRecord | null {
  const fs = getRuntimeFs();
  const pathModule = getRuntimePath();
  const paths = getPowerEaglePaths();
  if (!fs || !pathModule || !paths || !isGitRuntimeAvailable()) {
    return null;
  }

  ensurePowerEagleLayoutSync(fs, paths);

  const bucketDir = pathModule.join(paths.bucketsDir, bucketId);
  if (!fs.existsSync(bucketDir)) {
    return null;
  }

  const bucketManifestPath = pathModule.join(bucketDir, 'bucket.json');
  const bucketManifest = readJsonFileSync<Partial<HostBucketRecord>>(fs, bucketManifestPath);
  if (!bucketManifest?.url || bucketId === 'local') {
    return readBucketRecordSync(fs, pathModule, paths, bucketId);
  }

  const pullResult = pullGitRepository(bucketDir);
  if (!pullResult.ok) {
    return null;
  }

  writeJsonFileSync(
    fs,
    bucketManifestPath,
    createBucketManifest(
      bucketId,
      typeof bucketManifest.name === 'string' ? bucketManifest.name : bucketId,
      bucketManifest.url,
      typeof bucketManifest.branch === 'string' ? bucketManifest.branch : 'main',
      false,
      currentDateStamp(),
    ),
  );

  return readBucketRecordSync(fs, pathModule, paths, bucketId);
}

/**
 * Copy one local plugin folder into the local bucket and return its manifest stub.
 */
export function installLocalPluginFromHost(sourceDirectory: string): BucketPluginRecord | null {
  const fs = getRuntimeFs();
  const pathModule = getRuntimePath();
  const paths = getPowerEaglePaths();
  if (!fs || !pathModule || !paths) {
    return null;
  }

  ensurePowerEagleLayoutSync(fs, paths);

  const normalizedSource = sourceDirectory.trim();
  if (!normalizedSource || !fs.existsSync(normalizedSource) || !fs.statSync(normalizedSource).isDirectory()) {
    return null;
  }

  const manifest = readPluginManifestSync(fs, pathModule, normalizedSource);
  if (!manifest) {
    return null;
  }

  const targetDirectory = pathModule.join(paths.localBucketPluginsDir, manifest.id);
  if (fs.existsSync(targetDirectory)) {
    fs.rmSync(targetDirectory, { recursive: true, force: true });
  }

  copyDirectoryRecursiveSync(fs, pathModule, normalizedSource, targetDirectory);

  return manifest;
}

/**
 * Remove one local bucket plugin folder from ~/.powereagle and report whether it existed.
 */
export function removeLocalPluginFromHost(pluginId: string): boolean {
  const fs = getRuntimeFs();
  const pathModule = getRuntimePath();
  const paths = getPowerEaglePaths();
  if (!fs || !pathModule || !paths) {
    return false;
  }

  ensurePowerEagleLayoutSync(fs, paths);

  const pluginDirectory = pathModule.join(paths.localBucketPluginsDir, pluginId);
  if (!fs.existsSync(pluginDirectory) || !fs.statSync(pluginDirectory).isDirectory()) {
    return false;
  }

  fs.rmSync(pluginDirectory, { recursive: true, force: true });
  return true;
}

/**
 * Load persisted bucket records from ~/.powereagle when available.
 */
export function loadBucketRecordsFromHost(): HostBucketRecord[] | null {
  const fs = getRuntimeFs();
  const pathModule = getRuntimePath();
  const paths = getPowerEaglePaths();
  if (!fs || !pathModule || !paths) {
    return null;
  }

  ensurePowerEagleLayoutSync(fs, paths);
  migrateBundledLocalPluginPackagesSync(fs, pathModule, paths);
  return readBucketRecordsSync(fs, pathModule, paths);
}

/**
 * Load persisted installed plugin records from ~/.powereagle when available.
 */
export function loadInstalledPluginsFromHost(): InstalledPluginRecord[] | null {
  const fs = getRuntimeFs();
  const paths = getPowerEaglePaths();
  if (!fs || !paths) {
    return null;
  }

  ensurePowerEagleLayoutSync(fs, paths);
  const pathModule = getRuntimePath();
  if (pathModule) {
    migrateBundledLocalPluginPackagesSync(fs, pathModule, paths);
  }
  return readJsonFileSync<InstalledPluginRecord[]>(fs, paths.installedStateFile);
}

/**
 * Persist bucket records into ~/.powereagle when available.
 */
export function saveBucketRecordsToHost(bucketRecords: HostBucketRecord[]): void {
  const fs = getRuntimeFs();
  const pathModule = getRuntimePath();
  const paths = getPowerEaglePaths();
  if (!fs || !pathModule || !paths) {
    return;
  }

  ensurePowerEagleLayoutSync(fs, paths);
  syncBucketDirectoriesSync(fs, pathModule, paths, bucketRecords);
}

/**
 * Persist installed plugin records into ~/.powereagle when available.
 */
export function saveInstalledPluginsToHost(installedPlugins: InstalledPluginRecord[]): void {
  const fs = getRuntimeFs();
  const paths = getPowerEaglePaths();
  if (!fs || !paths) {
    return;
  }

  ensurePowerEagleLayoutSync(fs, paths);
  writeJsonFileSync(fs, paths.installedStateFile, installedPlugins);
}

/**
 * Resolve one installed plugin to its on-disk package root when host storage is available.
 */
export function resolveInstalledPluginRootFromHost(plugin: InstalledPluginRecord): string | null {
  const fs = getRuntimeFs();
  const pathModule = getRuntimePath();
  const paths = getPowerEaglePaths();
  if (!fs || !pathModule || !paths) {
    return null;
  }

  const bucketId = plugin.source === 'local' ? 'local' : plugin.bucketId;
  if (!bucketId) {
    return null;
  }

  const pluginRoot = pathModule.join(paths.bucketsDir, bucketId, 'plugins', plugin.id);
  if (!fs.existsSync(pluginRoot) || !fs.statSync(pluginRoot).isDirectory()) {
    return null;
  }

  const pluginJsonPath = pathModule.join(pluginRoot, 'plugin.json');
  if (!fs.existsSync(pluginJsonPath)) {
    return null;
  }

  return pluginRoot;
}

/**
 * Seed the local bucket with the recent-libraries package when it is missing.
 */
export function seedRecentLibrariesIntoLocalBucket(localPlugin: BucketPluginRecord): boolean {
  return seedBundledLocalPlugin(localPlugin, RECENT_LIBRARIES_SEED_FILES);
}

/**
 * Seed the local bucket with the file-creator package when it is missing.
 */
export function seedFileCreatorIntoLocalBucket(localPlugin: BucketPluginRecord): boolean {
  return seedBundledLocalPlugin(localPlugin, FILE_CREATOR_SEED_FILES);
}

/**
 * Seed one bundled local plugin into the local bucket without overwriting an existing folder.
 */
function seedBundledLocalPlugin(localPlugin: BucketPluginRecord, seedFiles: Record<string, string>): boolean {
  const fs = getRuntimeFs();
  const pathModule = getRuntimePath();
  const paths = getPowerEaglePaths();
  if (!fs || !pathModule || !paths) {
    return false;
  }

  ensurePowerEagleLayoutSync(fs, paths);

  const targetDirectory = pathModule.join(paths.localBucketPluginsDir, localPlugin.id);
  if (fs.existsSync(targetDirectory)) {
    return false;
  }

  writeSeededLocalPluginFiles(fs, pathModule, paths, localPlugin, seedFiles);
  return true;
}

/**
 * Resolve the host ~/.powereagle path layout.
 */
function getPowerEaglePaths(): PowerEaglePaths | null {
  const runtimePath = getRuntimePath();
  const homeDirectory = getRuntimeHomeDirectory();
  if (!runtimePath || !homeDirectory) {
    return null;
  }

  const baseDir = runtimePath.join(homeDirectory, '.powereagle');
  const bucketsDir = runtimePath.join(baseDir, 'buckets');
  const localBucketDir = runtimePath.join(bucketsDir, 'local');
  const localBucketPluginsDir = runtimePath.join(localBucketDir, 'plugins');
  return {
    baseDir,
    bucketsDir,
    localBucketDir,
    localBucketPluginsDir,
    downloadDir: runtimePath.join(baseDir, 'download'),
    cacheDir: runtimePath.join(baseDir, 'cache'),
    installedStateFile: runtimePath.join(baseDir, 'installed.json'),
    localBucketManifestFile: runtimePath.join(localBucketDir, 'bucket.json'),
  };
}

/**
 * Ensure the core ~/.powereagle directory structure exists.
 */
function ensurePowerEagleLayoutSync(fs: RuntimeFs, paths: PowerEaglePaths): void {
  const requiredDirectories = [
    paths.baseDir,
    paths.bucketsDir,
    paths.localBucketDir,
    paths.localBucketPluginsDir,
    paths.downloadDir,
    paths.cacheDir,
  ];

  for (const directory of requiredDirectories) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  if (!fs.existsSync(paths.localBucketManifestFile)) {
    writeJsonFileSync(fs, paths.localBucketManifestFile, createBucketManifest('local', 'local', 'local://power-eagle', 'workspace', true));
  }
}

/**
 * Write one seeded bundled plugin into the local bucket.
 */
function writeSeededLocalPluginFiles(
  fs: RuntimeFs,
  pathModule: RuntimePath,
  paths: PowerEaglePaths,
  localPlugin: BucketPluginRecord,
  seedFiles: Record<string, string>,
): void {
  const localPluginDir = pathModule.join(paths.localBucketPluginsDir, localPlugin.id);
  fs.mkdirSync(localPluginDir, { recursive: true });

  for (const [relativeFilePath, content] of Object.entries(seedFiles)) {
    const targetFilePath = pathModule.join(localPluginDir, ...relativeFilePath.split('/'));
    const targetDirectory = pathModule.dirname(targetFilePath);
    if (!fs.existsSync(targetDirectory)) {
      fs.mkdirSync(targetDirectory, { recursive: true });
    }
    fs.writeFileSync(targetFilePath, content, 'utf8');
  }

  writeJsonFileSync(fs, paths.localBucketManifestFile, {
    ...createBucketManifest('local', 'local', 'local://power-eagle', 'workspace', true),
    description: 'Local unpacked plugins managed by Power Eagle.',
  });
}

/**
 * Rewrite stale built-in local bucket packages into the canonical plugin.json layout.
 */
function migrateBundledLocalPluginPackagesSync(fs: RuntimeFs, pathModule: RuntimePath, paths: PowerEaglePaths): void {
  const bundledPackages = [
    {
      plugin: createRecentLibrariesPluginManifest(),
      seedFiles: RECENT_LIBRARIES_SEED_FILES,
    },
    {
      plugin: createFileCreatorPluginManifest(),
      seedFiles: FILE_CREATOR_SEED_FILES,
    },
  ];

  for (const bundledPackage of bundledPackages) {
    const pluginDir = pathModule.join(paths.localBucketPluginsDir, bundledPackage.plugin.id);
    if (!fs.existsSync(pluginDir) || !fs.statSync(pluginDir).isDirectory()) {
      continue;
    }

    if (!isLegacyBundledPluginPackageSync(fs, pathModule, pluginDir)) {
      continue;
    }

    fs.rmSync(pluginDir, { recursive: true, force: true });
    writeSeededLocalPluginFiles(fs, pathModule, paths, bundledPackage.plugin, bundledPackage.seedFiles);
  }
}

/**
 * Check whether one bundled plugin directory still uses the removed package layout.
 */
function isLegacyBundledPluginPackageSync(fs: RuntimeFs, pathModule: RuntimePath, pluginDir: string): boolean {
  const pluginJsonPath = pathModule.join(pluginDir, 'plugin.json');
  const pluginJson = readJsonFileSync<Record<string, unknown>>(fs, pluginJsonPath);
  if (!pluginJson || !isRecord(pluginJson.ui)) {
    return true;
  }

  return ['plugin.js', 'state.js', 'ui.json'].some((legacyFileName) => fs.existsSync(pathModule.join(pluginDir, legacyFileName)));
}

/**
 * Ensure one cloned bucket has a bucket.json metadata file.
 */
function ensureBucketManifestSync(
  fs: RuntimeFs,
  pathModule: RuntimePath,
  bucketDir: string,
  bucketId: string,
  url: string,
): void {
  const manifestPath = pathModule.join(bucketDir, 'bucket.json');
  const currentManifest = readJsonFileSync<Partial<HostBucketRecord>>(fs, manifestPath);
  writeJsonFileSync(
    fs,
    manifestPath,
    createBucketManifest(
      bucketId,
      typeof currentManifest?.name === 'string' ? currentManifest.name : bucketId,
      url,
      typeof currentManifest?.branch === 'string' ? currentManifest.branch : 'main',
      false,
      currentDateStamp(),
    ),
  );
}

/**
 * Read one plugin manifest from plugin.json within a plugin folder.
 */
function readPluginManifestSync(fs: RuntimeFs, pathModule: RuntimePath, pluginDirectory: string): BucketPluginRecord | null {
  const pluginJsonPath = pathModule.join(pluginDirectory, 'plugin.json');
  const pluginJson = readJsonFileSync<Record<string, unknown>>(fs, pluginJsonPath);
  if (!pluginJson || !isRecord(pluginJson.ui)) {
    return null;
  }

  const id = typeof pluginJson.id === 'string' ? pluginJson.id : null;
  const name = typeof pluginJson.name === 'string' ? pluginJson.name : null;
  const version = typeof pluginJson.version === 'string' ? pluginJson.version : null;
  const type = typeof pluginJson.type === 'string' ? pluginJson.type : null;
  if (!id || !name || !version || !type) {
    return null;
  }

  return {
    id,
    name,
    version,
    type,
    keywords: Array.isArray(pluginJson.keywords) ? pluginJson.keywords.filter((entry): entry is string => typeof entry === 'string') : [],
    description: typeof pluginJson.description === 'string' ? pluginJson.description : '',
  };
}

/**
 * Copy one directory tree recursively into a destination path.
 */
function copyDirectoryRecursiveSync(fs: RuntimeFs, pathModule: RuntimePath, sourceDirectory: string, targetDirectory: string): void {
  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  for (const entryName of fs.readdirSync(sourceDirectory)) {
    const sourcePath = pathModule.join(sourceDirectory, entryName);
    const targetPath = pathModule.join(targetDirectory, entryName);
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectoryRecursiveSync(fs, pathModule, sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

/**
 * Read bucket records by scanning ~/.powereagle/buckets/* directories.
 */
function readBucketRecordsSync(fs: RuntimeFs, pathModule: RuntimePath, paths: PowerEaglePaths): HostBucketRecord[] {
  const bucketIds = readDirectoryNamesSync(fs, pathModule, paths.bucketsDir);
  const records = bucketIds
    .map((bucketId) => readBucketRecordSync(fs, pathModule, paths, bucketId))
    .filter((record): record is HostBucketRecord => record !== null);

  return records.sort((left, right) => {
    if (left.id === 'local') {
      return -1;
    }

    if (right.id === 'local') {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

/**
 * Read one bucket record from its on-disk directory.
 */
function readBucketRecordSync(
  fs: RuntimeFs,
  pathModule: RuntimePath,
  paths: PowerEaglePaths,
  bucketId: string,
): HostBucketRecord | null {
  const bucketDir = pathModule.join(paths.bucketsDir, bucketId);
  const bucketManifest = readJsonFileSync<Partial<HostBucketRecord> & { description?: string }>(fs, pathModule.join(bucketDir, 'bucket.json'));
  if (!bucketManifest) {
    return null;
  }

  return {
    id: typeof bucketManifest.id === 'string' ? bucketManifest.id : bucketId,
    name: typeof bucketManifest.name === 'string' ? bucketManifest.name : bucketId,
    url: typeof bucketManifest.url === 'string' ? bucketManifest.url : `bucket://${bucketId}`,
    branch: typeof bucketManifest.branch === 'string' ? bucketManifest.branch : 'main',
    lastSync: typeof bucketManifest.lastSync === 'string' ? bucketManifest.lastSync : currentDateStamp(),
    status: 'ok',
    isLocal: Boolean(bucketManifest.isLocal) || bucketId === 'local',
    plugins: readBucketPluginsSync(fs, pathModule, bucketDir),
  };
}

/**
 * Read plugin manifests from one bucket's plugins/* directories.
 */
function readBucketPluginsSync(fs: RuntimeFs, pathModule: RuntimePath, bucketDir: string): BucketPluginRecord[] {
  const pluginsDir = pathModule.join(bucketDir, 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    return [];
  }

  return readDirectoryNamesSync(fs, pathModule, pluginsDir)
    .map((pluginId) => readPluginManifestSync(fs, pathModule, pathModule.join(pluginsDir, pluginId)))
    .filter((plugin): plugin is BucketPluginRecord => Boolean(plugin));
}

/**
 * Sync bucket directories and bucket.json manifests to the requested state.
 */
function syncBucketDirectoriesSync(
  fs: RuntimeFs,
  pathModule: RuntimePath,
  paths: PowerEaglePaths,
  bucketRecords: HostBucketRecord[],
): void {
  const desiredIds = new Set(bucketRecords.map((bucket) => bucket.id));

  for (const existingBucketId of readDirectoryNamesSync(fs, pathModule, paths.bucketsDir)) {
    if (existingBucketId === 'local' || desiredIds.has(existingBucketId)) {
      continue;
    }

    fs.rmSync(pathModule.join(paths.bucketsDir, existingBucketId), { recursive: true, force: true });
  }

  for (const bucket of bucketRecords) {
    const bucketDir = pathModule.join(paths.bucketsDir, bucket.id);
    const pluginsDir = pathModule.join(bucketDir, 'plugins');

    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }

    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    writeJsonFileSync(
      fs,
      pathModule.join(bucketDir, 'bucket.json'),
      createBucketManifest(bucket.id, bucket.name, bucket.url, bucket.branch, Boolean(bucket.isLocal), bucket.lastSync),
    );
  }
}

/**
 * Create the canonical bucket.json payload for one bucket directory.
 */
function createBucketManifest(
  id: string,
  name: string,
  url: string,
  branch: string,
  isLocal: boolean,
  lastSync = currentDateStamp(),
): Record<string, string | boolean> {
  return {
    id,
    name,
    url,
    branch,
    lastSync,
    status: 'ok',
    isLocal,
  };
}

/**
 * Create the canonical plugin.json payload for the seeded recent-libraries plugin.
 */
function createRecentLibrariesPluginManifest(): BucketPluginRecord {
  return {
    id: 'recent-libraries',
    name: 'Recent Libraries',
    version: '2.0.0',
    type: 'button',
    keywords: ['library', 'management'],
    description: 'Browse and manage Eagle library history through the v2 runtime.',
  };
}

/**
 * Create the canonical plugin.json payload for the seeded file-creator plugin.
 */
function createFileCreatorPluginManifest(): BucketPluginRecord {
  return {
    id: 'file-creator',
    name: 'File Creator',
    version: '2.0.0',
    type: 'button',
    keywords: ['files', 'create'],
    description: 'Create files with custom extensions.',
  };
}

/**
 * Read only subdirectory names from one parent directory.
 */
function readDirectoryNamesSync(fs: RuntimeFs, pathModule: RuntimePath, targetDirectory: string): string[] {
  if (!fs.existsSync(targetDirectory)) {
    return [];
  }

  return fs.readdirSync(targetDirectory).filter((entryName) => {
    const entryPath = pathModule.join(targetDirectory, entryName);
    return fs.statSync(entryPath).isDirectory();
  });
}

/**
 * Read one JSON file from the host filesystem.
 */
function readJsonFileSync<T>(fs: RuntimeFs, filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

/**
 * Write one JSON file to the host filesystem.
 */
function writeJsonFileSync(fs: RuntimeFs, filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

/**
 * Check whether an unknown value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Format the current day as YYYY-MM-DD for bucket sync metadata.
 */
function currentDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolve the runtime home directory through Node APIs.
 */
function getRuntimeHomeDirectory(): string | null {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    return null;
  }

  try {
    const osModule = runtimeRequire('os') as { homedir(): string };
    const homeDirectory = osModule.homedir();
    return homeDirectory || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the runtime fs module through Node APIs.
 */
function getRuntimeFs(): RuntimeFs | null {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    return null;
  }

  try {
    return runtimeRequire('fs') as RuntimeFs;
  } catch {
    return null;
  }
}

/**
 * Resolve the runtime path module through Node APIs.
 */
function getRuntimePath(): RuntimePath | null {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    return null;
  }

  try {
    return runtimeRequire('path') as RuntimePath;
  } catch {
    return null;
  }
}

/**
 * Resolve runtime require when the host exposes CommonJS access.
 */
function getRuntimeRequire(): RuntimeRequire {
  const globalWindow = typeof window !== 'undefined' ? window as unknown as { require?: (moduleName: string) => unknown } : null;
  if (globalWindow?.require) {
    return globalWindow.require;
  }

  try {
    return Function('return typeof require !== "undefined" ? require : null')() as RuntimeRequire;
  } catch {
    return null;
  }
}

interface RuntimeFs {
  existsSync(targetPath: string): boolean;
  mkdirSync(targetPath: string, options?: { recursive?: boolean }): void;
  writeFileSync(targetPath: string, content: string, encoding: string): void;
  readFileSync(targetPath: string, encoding: string): string;
  readdirSync(targetPath: string): string[];
  statSync(targetPath: string): { isDirectory(): boolean };
  copyFileSync(sourcePath: string, targetPath: string): void;
  renameSync(sourcePath: string, targetPath: string): void;
  rmSync(targetPath: string, options?: { recursive?: boolean; force?: boolean }): void;
}

interface RuntimePath {
  join(...pathSegments: string[]): string;
  dirname(targetPath: string): string;
}