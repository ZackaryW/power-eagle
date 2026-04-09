import type { ActivatedPlugin } from '../core/types/plugin';
import { createBucketFromUrl, createBucketIdFromUrl, createInstalledPluginFromLocalPath, createInstalledPluginFromUrl, loadBucketRecords, pickLocalPluginDirectory, refreshBucketRecord, restoreDismissedSeededPlugin, toInstalledPluginRecord, todayStamp } from './host-data';
import type { HostBucketRecord, HostEvent, HostTab, InstalledPluginRecord } from './host-types';
import { EmptyState, InfoRow, Panel, ShellButton } from './shell-primitives';
import { PluginWindow } from './runtime-plugin-view';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';

interface InstalledViewProps {
  selectedInstalled: InstalledPluginRecord | null;
  launchedPluginId: string | null;
  activatedPlugin: ActivatedPlugin | null;
  onClosePlugin: () => void;
  onLaunchPlugin: (plugin: InstalledPluginRecord) => void;
  onTogglePlugin: (pluginId: string) => void;
  onRemovePlugin: (plugin: InstalledPluginRecord) => void;
  syncPluginView: () => void;
}

/**
 * Render the installed tab detail pane and active plugin window.
 */
export function InstalledView(props: InstalledViewProps): JSX.Element {
  const {
    selectedInstalled,
    launchedPluginId,
    activatedPlugin,
    onClosePlugin,
    onLaunchPlugin,
    onTogglePlugin,
    onRemovePlugin,
    syncPluginView,
  } = props;

  if (!selectedInstalled) {
    return (
      <EmptyState
        title="select an installed plugin"
        description="double-click to launch · single-click to inspect"
      />
    );
  }

  if (launchedPluginId === selectedInstalled.id) {
    return (
      <PluginWindow
        plugin={selectedInstalled}
        activatedPlugin={activatedPlugin}
        onClosePlugin={onClosePlugin}
        syncPluginView={syncPluginView}
      />
    );
  }

  return (
    <div className="p-5 text-foreground md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{selectedInstalled.name}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{selectedInstalled.description}</p>
        </div>
        <button className={`flex items-center gap-2 text-sm ${selectedInstalled.enabled ? 'text-foreground' : 'text-muted-foreground/70'}`} onClick={() => onTogglePlugin(selectedInstalled.id)} type="button">
          <Switch checked={selectedInstalled.enabled} />
          <span>{selectedInstalled.enabled ? 'enabled' : 'disabled'}</span>
        </button>
      </div>

      <Panel label="info">
        <InfoRow label="id" value={selectedInstalled.id} />
        <InfoRow label="version" value={selectedInstalled.version} />
        <InfoRow label="source" value={selectedInstalled.source === 'local' ? 'local bucket' : selectedInstalled.bucketId ?? selectedInstalled.source} />
        <InfoRow label="keywords" value={selectedInstalled.keywords.join(', ')} />
      </Panel>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ShellButton
          variant="launch"
          disabled={!selectedInstalled.enabled}
          label="launch"
          onClick={() => onLaunchPlugin(selectedInstalled)}
        />
        <ShellButton variant="danger" className="ml-auto" label="remove" onClick={() => onRemovePlugin(selectedInstalled)} />
      </div>

      {!selectedInstalled.enabled ? (
        <p className="mt-3 text-xs text-muted-foreground">enable the plugin to launch it</p>
      ) : null}
    </div>
  );
}

interface HostInspectorPopoverProps {
  launchedPlugin: InstalledPluginRecord | null;
  activeLibraryPath: string | null;
  hostEvents: HostEvent[];
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Render the global host inspector as a hideable popout.
 */
export function HostInspectorPopover(props: HostInspectorPopoverProps): JSX.Element | null {
  const {
    launchedPlugin,
    activeLibraryPath,
    hostEvents,
    isOpen,
    onToggle,
  } = props;

  if (!launchedPlugin && !hostEvents.length) {
    return null;
  }

  return (
    <aside className={`pointer-events-none fixed right-6 top-24 z-30 flex w-[340px] justify-end transition-all duration-200 ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+1.5rem)] opacity-0'}`}>
      <div className="pointer-events-auto w-full rounded-[22px] border border-border/90 bg-card/95 p-4 shadow-[0_24px_70px_hsl(var(--foreground)/0.16)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-[-0.02em] text-foreground">Host Inspector</div>
            <div className="text-xs text-muted-foreground">Runtime and event state live here, outside the plugin surface.</div>
          </div>
          <ShellButton label="hide" onClick={onToggle} />
        </div>

        <Panel label="runtime">
          <InfoRow label="active lib" value={activeLibraryPath ?? 'none'} />
          <InfoRow label="package" value={launchedPlugin?.id ?? 'none'} />
          <InfoRow
            label="source"
            value={launchedPlugin ? (launchedPlugin.source === 'local' ? 'local bucket' : launchedPlugin.bucketId ?? launchedPlugin.source) : 'none'}
          />
        </Panel>

        <Panel label="host events" className="mt-4">
          {hostEvents.length ? hostEvents.map((event) => (
            <article key={event.id} className="mb-2 rounded-xl border border-border bg-muted/35 p-3 last:mb-0">
              <div className="text-sm font-medium text-foreground">{event.title}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{event.description ?? 'No description'}</div>
            </article>
          )) : (
            <div className="text-xs text-muted-foreground">No host events yet.</div>
          )}
        </Panel>
      </div>
    </aside>
  );
}

interface BucketsViewProps {
  selectedBucket: HostBucketRecord | null;
  bucketRecords: HostBucketRecord[];
  installedPlugins: InstalledPluginRecord[];
  bucketUrlInput: string;
  gitAvailable: boolean;
  onGitUnavailable: () => void;
  setBucketUrlInput: React.Dispatch<React.SetStateAction<string>>;
  setSelectedBucketId: React.Dispatch<React.SetStateAction<string>>;
  setBucketRecords: React.Dispatch<React.SetStateAction<HostBucketRecord[]>>;
  setInstalledPlugins: React.Dispatch<React.SetStateAction<InstalledPluginRecord[]>>;
  setCurrentTab: React.Dispatch<React.SetStateAction<HostTab>>;
  setSelectedInstalledId: React.Dispatch<React.SetStateAction<string | null>>;
  onRemovePlugin: (plugin: InstalledPluginRecord) => void;
}

/**
 * Render the buckets tab with managed bucket and install actions.
 */
export function BucketsView(props: BucketsViewProps): JSX.Element {
  const {
    selectedBucket,
    bucketRecords,
    installedPlugins,
    bucketUrlInput,
    gitAvailable,
    onGitUnavailable,
    setBucketUrlInput,
    setSelectedBucketId,
    setBucketRecords,
    setInstalledPlugins,
    setCurrentTab,
    setSelectedInstalledId,
    onRemovePlugin,
  } = props;

  if (!selectedBucket) {
    return <EmptyState title="no buckets configured" description="add a bucket URL to get started" />;
  }

  if (!gitAvailable) {
    return (
      <div className="p-5 text-foreground md:p-6">
        <Panel label="buckets unavailable">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Git process execution is not available in this runtime, so remote bucket clone and sync actions are disabled.
            </div>
            <ShellButton label="show error" onClick={onGitUnavailable} />
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="p-5 text-foreground md:p-6">
      <Panel label="managed buckets">
        {bucketRecords.map((bucket) => (
          <div
            key={bucket.id}
            className={`mb-2 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3 last:mb-0 ${bucket.id === selectedBucket.id ? 'border-border bg-accent/40 shadow-sm' : 'border-border bg-card/70'}`}
          >
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => setSelectedBucketId(bucket.id)}
              type="button"
            >
              <div className="text-sm font-medium text-foreground">{bucket.name}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{bucket.url}</div>
            </button>
            <Badge className="rounded-md px-2 py-1 text-[10px]" variant="outline">synced {bucket.lastSync}</Badge>
            {!bucket.isLocal ? <ShellButton label="sync" onClick={() => {
              const refreshedBucket = refreshBucketRecord(bucket.id);
              if (refreshedBucket) {
                setBucketRecords((current) => current.map((entry) => (
                  entry.id === bucket.id ? refreshedBucket : entry
                )));
                return;
              }

              setBucketRecords((current) => current.map((entry) => (
                entry.id === bucket.id ? { ...entry, lastSync: todayStamp() } : entry
              )));
            }} /> : null}
            {!bucket.isLocal ? <ShellButton variant="danger" label="remove" onClick={() => {
              setBucketRecords((current) => current.filter((entry) => entry.id !== bucket.id));
            }} /> : null}
          </div>
        ))}
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <Input
            className="flex-1"
            placeholder="https://github.com/user/my-bucket"
            value={bucketUrlInput}
            onChange={(event) => setBucketUrlInput(event.target.value)}
          />
          <ShellButton label="add bucket" onClick={() => {
            const trimmedUrl = bucketUrlInput.trim();
            if (!trimmedUrl) {
              return;
            }

            const nextBucket = createBucketFromUrl(trimmedUrl);
            const nextBucketId = createBucketIdFromUrl(trimmedUrl);
            setBucketRecords((current) => current.some((bucket) => bucket.id === nextBucketId || bucket.id === nextBucket.id)
              ? current.map((bucket) => (bucket.id === nextBucketId ? nextBucket : bucket))
              : [...current, nextBucket]);
            setSelectedBucketId(nextBucket.id);
            setBucketUrlInput('');
          }} />
        </div>
      </Panel>

      <Panel label={`index — ${selectedBucket.name} (${selectedBucket.plugins.length} plugins)`} className="mt-5">
        {selectedBucket.plugins.length ? selectedBucket.plugins.map((plugin) => {
          const installed = installedPlugins.find((entry) => entry.id === plugin.id);
          return (
            <div key={plugin.id} className="mb-2 flex flex-wrap items-center gap-3 border-b border-border py-3 last:mb-0 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {plugin.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">v{plugin.version}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{plugin.id} · {plugin.description}</div>
              </div>
              {installed ? (
                <Badge className="rounded-md px-2 py-1 text-[10px]" variant={installed.version === plugin.version ? 'default' : 'secondary'}>
                  installed {installed.version}
                </Badge>
              ) : null}
              {installed ? (
                <ShellButton variant="danger" label="remove" onClick={() => {
                  onRemovePlugin(installed);
                }} />
              ) : (
                <ShellButton label="install" onClick={() => {
                  const nextInstalled = toInstalledPluginRecord(plugin, selectedBucket.id, selectedBucket.isLocal ? 'local' : 'bucket');
                  restoreDismissedSeededPlugin(plugin.id);
                  setInstalledPlugins((current) => current.some((entry) => entry.id === plugin.id) ? current : [...current, nextInstalled]);
                  setSelectedInstalledId(plugin.id);
                  setCurrentTab('installed');
                }} />
              )}
            </div>
          );
        }) : (
          <div className="text-sm text-muted-foreground">No plugin folders are present in this bucket yet.</div>
        )}
      </Panel>
    </div>
  );
}

interface UrlInstallViewProps {
  pluginUrlInput: string;
  localPluginPathInput: string;
  setPluginUrlInput: React.Dispatch<React.SetStateAction<string>>;
  setLocalPluginPathInput: React.Dispatch<React.SetStateAction<string>>;
  setBucketRecords: React.Dispatch<React.SetStateAction<HostBucketRecord[]>>;
  setInstalledPlugins: React.Dispatch<React.SetStateAction<InstalledPluginRecord[]>>;
  setCurrentTab: React.Dispatch<React.SetStateAction<HostTab>>;
  setSelectedInstalledId: React.Dispatch<React.SetStateAction<string | null>>;
  hostEvents: HostEvent[];
}

/**
 * Render the direct URL install tab.
 */
export function UrlInstallView(props: UrlInstallViewProps): JSX.Element {
  const {
    pluginUrlInput,
    localPluginPathInput,
    setPluginUrlInput,
    setLocalPluginPathInput,
    setBucketRecords,
    setInstalledPlugins,
    setCurrentTab,
    setSelectedInstalledId,
    hostEvents,
  } = props;

  return (
    <div className="p-5 text-foreground md:p-6">
      <Panel label="install from url">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            className="flex-1"
            placeholder="https://example.com/my-plugin.zip"
            value={pluginUrlInput}
            onChange={(event) => setPluginUrlInput(event.target.value)}
          />
          <ShellButton label="install" onClick={() => {
            const trimmedUrl = pluginUrlInput.trim();
            if (!trimmedUrl) {
              return;
            }

            const installedRecord = createInstalledPluginFromUrl(trimmedUrl);
            restoreDismissedSeededPlugin(installedRecord.id);
            setInstalledPlugins((current) => current.some((plugin) => plugin.id === installedRecord.id) ? current : [...current, installedRecord]);
            setSelectedInstalledId(installedRecord.id);
            setCurrentTab('installed');
            setPluginUrlInput('');
          }} />
        </div>
      </Panel>

      <Panel label="about local plugins" className="mt-5">
        <InfoRow label="source" value="local — not tied to any remote bucket" />
        <InfoRow label="updates" value="manual only — paste the URL again to replace it" />
        <InfoRow label="format" value="must resolve to a zip-like plugin package" />
      </Panel>

      <Panel label="install from local folder" className="mt-5">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            className="flex-1"
            placeholder="F:/path/to/plugin-folder"
            value={localPluginPathInput}
            onChange={(event) => setLocalPluginPathInput(event.target.value)}
          />
          <ShellButton label="browse" onClick={() => {
            void pickLocalPluginDirectory().then((selectedPath) => {
              if (selectedPath) {
                setLocalPluginPathInput(selectedPath);
              }
            });
          }} />
          <ShellButton label="install local" onClick={() => {
            const trimmedPath = localPluginPathInput.trim();
            if (!trimmedPath) {
              return;
            }

            const installedRecord = createInstalledPluginFromLocalPath(trimmedPath);
            if (!installedRecord) {
              return;
            }

            restoreDismissedSeededPlugin(installedRecord.id);
            setBucketRecords(() => loadBucketRecords());
            setInstalledPlugins((current) => current.some((plugin) => plugin.id === installedRecord.id)
              ? current.map((plugin) => (plugin.id === installedRecord.id ? installedRecord : plugin))
              : [...current, installedRecord]);
            setSelectedInstalledId(installedRecord.id);
            setCurrentTab('installed');
            setLocalPluginPathInput('');
          }} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Point this at a v2 plugin folder such as the repo fixture at `src/fixtures/file-creator/file-creator`.</p>
      </Panel>

      <Panel label="recent host events" className="mt-5">
        {hostEvents.length ? hostEvents.map((event) => (
          <article key={event.id} className="mb-2 rounded-xl border border-border bg-muted/35 p-3 last:mb-0">
            <div className="text-sm font-medium text-foreground">{event.title}</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{event.description ?? 'No description'}</div>
          </article>
        )) : (
          <div className="text-xs text-muted-foreground">No host events yet.</div>
        )}
      </Panel>
    </div>
  );
}

interface GitUnavailableDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Render a simple modal that explains why buckets are unavailable.
 */
export function GitUnavailableDialog({ isOpen, onClose }: GitUnavailableDialogProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-[0_24px_70px_hsl(var(--foreground)/0.18)]">
        <div className="text-lg font-semibold tracking-[-0.02em] text-foreground">Git Not Available</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The buckets view requires host process execution for git clone and git pull. This runtime does not expose git execution, so bucket management is disabled.
        </p>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose} type="button" variant="outline">close</Button>
        </div>
      </div>
    </div>
  );
}