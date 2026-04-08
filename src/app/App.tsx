import { useEffect, useMemo, useState } from 'react';
import { activatePluginPackage } from '../core/runtime/activation';
import { activateLoadedPlugin } from '../core/runtime/activate-loaded-plugin';
import type { ActivatedPlugin } from '../core/types/plugin';
import { HostRuntimePluginFileSystem } from './host-plugin-fs';
import { fileCreatorParsedPackage, fileCreatorRegistry } from '../fixtures/file-creator/package';
import { recentLibrariesParsedPackage, recentLibrariesRegistry } from '../fixtures/recent-libraries/package';
import {
  dismissSeededPlugin,
  loadBucketRecords,
  loadInstalledPlugins,
  matchesInstalledFilter,
  removeLocalBucketPlugin,
  saveJsonStorage,
  seedLocalBucketOnce,
  BUCKETS_STORAGE_KEY,
  INSTALLED_STORAGE_KEY,
} from './host-data';
import { BucketsView, GitUnavailableDialog, HostInspectorPopover, InstalledView, UrlInstallView } from './host-views';
import type { HostEvent, HostTab } from './host-types';
import { isHostInstallStoreAvailable, resolveInstalledPluginRootFromHost } from './install-store';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { cloneActivatedPlugin, createHostEagle } from './runtime-plugin-view';
import { isGitRuntimeAvailable } from './utils/git';

/**
 * Render the host shell and launch real plugins inside it.
 */
export function App(): JSX.Element {
  const gitAvailable = isGitRuntimeAvailable();
  const [currentTab, setCurrentTab] = useState<HostTab>(gitAvailable ? 'buckets' : 'installed');
  const [installedPlugins, setInstalledPlugins] = useState(() => loadInstalledPlugins());
  const [bucketRecords, setBucketRecords] = useState(() => loadBucketRecords());
  const [selectedInstalledId, setSelectedInstalledId] = useState<string | null>(null);
  const [launchedPluginId, setLaunchedPluginId] = useState<string | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState(() => loadBucketRecords()[0]?.id ?? 'local');
  const [installedFilter, setInstalledFilter] = useState('');
  const [bucketUrlInput, setBucketUrlInput] = useState('');
  const [pluginUrlInput, setPluginUrlInput] = useState('');
  const [localPluginPathInput, setLocalPluginPathInput] = useState('');
  const [activatedPlugin, setActivatedPlugin] = useState<ActivatedPlugin | null>(null);
  const [hostEvents, setHostEvents] = useState<HostEvent[]>([]);
  const [activeLibraryPath, setActiveLibraryPath] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [gitDialogOpen, setGitDialogOpen] = useState(false);
  const hostEagle = useMemo(() => createHostEagle(setHostEvents, setActiveLibraryPath), []);

  /**
   * Remove one installed plugin and delete the local bucket package when the source is local.
   */
  function handleRemovePlugin(plugin: { id: string; source?: string | null }): void {
    dismissSeededPlugin(plugin.id);

    if (plugin.source === 'local' && isHostInstallStoreAvailable()) {
      removeLocalBucketPlugin(plugin.id);
      setBucketRecords(loadBucketRecords());
    }

    setInstalledPlugins((current) => current.filter((entry) => entry.id !== plugin.id));
  }

  useEffect(() => {
    seedLocalBucketOnce(setBucketRecords, setInstalledPlugins);
  }, []);

  useEffect(() => {
    saveJsonStorage(BUCKETS_STORAGE_KEY, bucketRecords);
  }, [bucketRecords]);

  useEffect(() => {
    saveJsonStorage(INSTALLED_STORAGE_KEY, installedPlugins);
  }, [installedPlugins]);

  useEffect(() => {
    if (!installedPlugins.length) {
      setSelectedInstalledId(null);
      setLaunchedPluginId(null);
      return;
    }

    if (!selectedInstalledId || !installedPlugins.some((plugin) => plugin.id === selectedInstalledId)) {
      setSelectedInstalledId(installedPlugins[0].id);
    }

    if (launchedPluginId && !installedPlugins.some((plugin) => plugin.id === launchedPluginId)) {
      setLaunchedPluginId(null);
      setActivatedPlugin(null);
    }
  }, [installedPlugins, launchedPluginId, selectedInstalledId]);

  useEffect(() => {
    if (!bucketRecords.length) {
      return;
    }

    if (!bucketRecords.some((bucket) => bucket.id === selectedBucketId)) {
      setSelectedBucketId(bucketRecords[0].id);
    }
  }, [bucketRecords, selectedBucketId]);

  useEffect(() => {
    const builtInFixtures = {
      [recentLibrariesParsedPackage.manifest.id]: {
        parsedPackage: recentLibrariesParsedPackage,
        registry: recentLibrariesRegistry,
      },
      [fileCreatorParsedPackage.manifest.id]: {
        parsedPackage: fileCreatorParsedPackage,
        registry: fileCreatorRegistry,
      },
    } as const;

    const launchedPlugin = launchedPluginId
      ? installedPlugins.find((plugin) => plugin.id === launchedPluginId) ?? null
      : null;

    if (!launchedPluginId || !launchedPlugin) {
      setActivatedPlugin(null);
      return;
    }

    let active = true;
    const activate = async (): Promise<void> => {
      try {
        if (isHostInstallStoreAvailable()) {
          const pluginRoot = resolveInstalledPluginRootFromHost(launchedPlugin);
          if (!pluginRoot) {
            throw new Error(`No plugin.json package root was found for ${launchedPlugin.id}.`);
          }

          const plugin = await activatePluginPackage(pluginRoot, new HostRuntimePluginFileSystem(), hostEagle);
          if (!active) {
            return;
          }

          setActivatedPlugin(plugin);
          return;
        }

        const selectedFixture = builtInFixtures[launchedPlugin.id as keyof typeof builtInFixtures];
        if (!selectedFixture) {
          throw new Error(`No bundled preview fixture is available for ${launchedPlugin.id}.`);
        }

        const plugin = await activateLoadedPlugin(selectedFixture.parsedPackage, selectedFixture.registry, hostEagle);
        if (!active) {
          return;
        }

        setActivatedPlugin(plugin);
        return;

        if (!active) {
          return;
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setActivatedPlugin(null);
        setHostEvents((events) => [
          {
            id: Date.now() + events.length,
            title: 'Plugin Launch Failed',
            description: error instanceof Error ? error.message : `Unable to launch ${launchedPlugin.id}.`,
          },
          ...events,
        ].slice(0, 10));
      }
    };

    void activate();

    return () => {
      active = false;
    };
  }, [hostEagle, installedPlugins, launchedPluginId]);

  const visibleInstalled = installedPlugins.filter((plugin) => matchesInstalledFilter(plugin, installedFilter));
  const selectedInstalled = installedPlugins.find((plugin) => plugin.id === selectedInstalledId) ?? null;
  const selectedBucket = bucketRecords.find((bucket) => bucket.id === selectedBucketId) ?? bucketRecords[0] ?? null;
  const launchedInstalled = installedPlugins.find((plugin) => plugin.id === launchedPluginId) ?? null;
  const hasInspectorContent = Boolean(launchedInstalled || hostEvents.length);

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950 md:px-6">
      <section className="relative mx-auto flex min-h-[720px] max-w-7xl overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-sm md:px-5">
            <div className="text-sm font-semibold tracking-[-0.02em] text-slate-950">
              power<span className="font-medium text-slate-500">eagle</span>
              <span className="ml-2 align-middle"><Badge variant="outline" className="rounded-md px-2 py-0.5 text-[10px] font-medium">v2.0</Badge></span>
            </div>
            <Tabs className="ml-auto" onValueChange={(value) => setCurrentTab(value as HostTab)} value={currentTab}>
              <TabsList>
                <TabsTrigger value="installed">installed</TabsTrigger>
                {gitAvailable ? (
                  <TabsTrigger value="buckets">buckets</TabsTrigger>
                ) : (
                  <Button
                    aria-disabled="true"
                    className="h-8 rounded-sm px-3 py-1.5 text-sm opacity-50"
                    onClick={() => setGitDialogOpen(true)}
                    type="button"
                    variant="ghost"
                  >
                    buckets
                  </Button>
                )}
                <TabsTrigger value="url">url install</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              disabled={!hasInspectorContent}
              size="sm"
              variant={inspectorOpen ? 'secondary' : 'outline'}
              onClick={() => setInspectorOpen((current) => !current)}
            >
              inspector
            </Button>
            <Button disabled size="sm" variant="ghost">ai [soon]</Button>
          </header>
          <div className="flex min-h-0 flex-1">
            <aside className="flex w-[248px] flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50/70">
              <div className="border-b border-slate-200 p-3">
                <Input
                  className="w-full"
                  placeholder="filter installed..."
                  value={installedFilter}
                  onChange={(event) => setInstalledFilter(event.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 text-sm">
                {visibleInstalled.length ? visibleInstalled.map((plugin) => {
                  const isSelected = currentTab === 'installed' && selectedInstalledId === plugin.id;
                  const isRunning = launchedPluginId === plugin.id;
                  return (
                    <button
                      key={plugin.id}
                      className={`mb-1.5 flex w-full flex-col rounded-xl border px-3 py-3 text-left transition ${isSelected ? 'border-slate-200 bg-white shadow-sm' : isRunning ? 'border-slate-300 bg-white' : 'border-transparent hover:bg-white hover:shadow-sm'}`}
                      onClick={() => {
                        setSelectedInstalledId(plugin.id);
                        setCurrentTab('installed');
                      }}
                      onDoubleClick={() => {
                        launchInstalledPlugin(plugin, setCurrentTab, setSelectedInstalledId, setLaunchedPluginId);
                      }}
                      type="button"
                    >
                      <span className="flex items-center gap-1.5 text-slate-900">
                        <span className="font-medium">{plugin.name}</span>
                        <Badge className="rounded-md px-2 py-0.5 text-[10px] font-medium" variant={plugin.source === 'local' ? 'default' : 'outline'}>
                          {plugin.source === 'local' ? 'local' : plugin.bucketId ?? '?'}
                        </Badge>
                        {isRunning ? <Badge className="rounded-md px-2 py-0.5 text-[10px] font-medium" variant="secondary">running</Badge> : null}
                      </span>
                      <span className="mt-1 text-xs text-slate-500">{plugin.id} · v{plugin.version}</span>
                      {!plugin.enabled ? <span className="mt-1 text-[10px] text-slate-400">[off]</span> : null}
                      {!isRunning ? <span className="mt-1 text-[10px] text-slate-400">double-click to launch</span> : null}
                    </button>
                  );
                }) : (
                  <div className="px-3 py-4 text-sm text-slate-500">{installedPlugins.length ? 'no match' : 'no plugins installed'}</div>
                )}
              </div>
            </aside>
            <section className="min-w-0 flex-1 overflow-y-auto bg-slate-50/40">
              {currentTab === 'installed' ? (
                <InstalledView
                  selectedInstalled={selectedInstalled}
                  launchedPluginId={launchedPluginId}
                  activatedPlugin={activatedPlugin}
                  onClosePlugin={() => {
                    setLaunchedPluginId(null);
                    setActivatedPlugin(null);
                    setActiveLibraryPath(null);
                  }}
                  onLaunchPlugin={(plugin) => {
                    launchInstalledPlugin(plugin, setCurrentTab, setSelectedInstalledId, setLaunchedPluginId);
                    setInspectorOpen(true);
                  }}
                  onTogglePlugin={(pluginId) => {
                    setInstalledPlugins((current) => current.map((plugin) => (
                      plugin.id === pluginId ? { ...plugin, enabled: !plugin.enabled } : plugin
                    )));
                  }}
                  onRemovePlugin={handleRemovePlugin}
                  syncPluginView={() => {
                    setActivatedPlugin((current) => current ? cloneActivatedPlugin(current) : current);
                  }}
                />
              ) : null}
              {currentTab === 'buckets' ? (
                <BucketsView
                  selectedBucket={selectedBucket}
                  bucketRecords={bucketRecords}
                  installedPlugins={installedPlugins}
                  bucketUrlInput={bucketUrlInput}
                  gitAvailable={gitAvailable}
                  onGitUnavailable={() => setGitDialogOpen(true)}
                  setBucketUrlInput={setBucketUrlInput}
                  setSelectedBucketId={setSelectedBucketId}
                  setBucketRecords={setBucketRecords}
                  setInstalledPlugins={setInstalledPlugins}
                  setCurrentTab={setCurrentTab}
                  setSelectedInstalledId={setSelectedInstalledId}
                  onRemovePlugin={handleRemovePlugin}
                />
              ) : null}
              {currentTab === 'url' ? (
                <UrlInstallView
                  pluginUrlInput={pluginUrlInput}
                  localPluginPathInput={localPluginPathInput}
                  setPluginUrlInput={setPluginUrlInput}
                  setLocalPluginPathInput={setLocalPluginPathInput}
                  setBucketRecords={setBucketRecords}
                  setInstalledPlugins={setInstalledPlugins}
                  setCurrentTab={setCurrentTab}
                  setSelectedInstalledId={setSelectedInstalledId}
                  hostEvents={hostEvents}
                />
              ) : null}
            </section>
          </div>
        </div>
        <HostInspectorPopover
          activeLibraryPath={activeLibraryPath}
          hostEvents={hostEvents}
          isOpen={inspectorOpen}
          launchedPlugin={launchedInstalled}
          onToggle={() => setInspectorOpen((current) => !current)}
        />
        <GitUnavailableDialog isOpen={gitDialogOpen} onClose={() => setGitDialogOpen(false)} />
      </section>
    </main>
  );
}

/**
 * Launch one installed plugin into the shell window.
 */
function launchInstalledPlugin(
  plugin: { id: string; enabled: boolean },
  setCurrentTab: React.Dispatch<React.SetStateAction<HostTab>>,
  setSelectedInstalledId: React.Dispatch<React.SetStateAction<string | null>>,
  setLaunchedPluginId: React.Dispatch<React.SetStateAction<string | null>>,
): void {
  if (!plugin.enabled) {
    return;
  }

  setSelectedInstalledId(plugin.id);
  setCurrentTab('installed');
  setLaunchedPluginId(plugin.id);
}