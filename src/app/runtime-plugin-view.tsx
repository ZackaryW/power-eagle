import { useState } from 'react';
import { invokeRuntimeTuple } from '../core/runtime/invoke-runtime-tuple';
import type { ActivatedPlugin, UiNode } from '../core/types/plugin';
import type { HostEagleRuntime } from '../sdk';
import type { HostEvent, InstalledPluginRecord } from './host-types';
import { EmptyState, ShellButton } from './shell-primitives';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

/**
 * Create a browser host Eagle runtime that records visible events in the shell.
 */
export function createHostEagle(
  setHostEvents: React.Dispatch<React.SetStateAction<HostEvent[]>>,
  setActiveLibraryPath: React.Dispatch<React.SetStateAction<string | null>>,
): HostEagleRuntime {
  return {
    notification: {
      async show(titleOrOptions: string | { title: string; description?: string; body?: string }, maybeOptions?: { description?: string; body?: string }): Promise<void> {
        const payload = typeof titleOrOptions === 'string'
          ? { title: titleOrOptions, description: maybeOptions?.description ?? maybeOptions?.body }
          : titleOrOptions;

        setHostEvents((events) => [
          { id: Date.now() + events.length, title: payload.title, description: payload.description ?? payload.body },
          ...events,
        ].slice(0, 10));
      },
    },
    library: {
      async switch(nextLibraryPath: string): Promise<void> {
        setActiveLibraryPath(nextLibraryPath);
      },
    },
    item: {
      async addTags(): Promise<void> {
        return undefined;
      },
      async addFromPath(filePath: string, options?: { name?: string }): Promise<string> {
        const hostAddFromPath = resolveHostAddFromPath();
        if (hostAddFromPath) {
          return hostAddFromPath(filePath, options);
        }

        setHostEvents((events) => [
          {
            id: Date.now() + events.length,
            title: 'Imported File',
            description: `Imported ${options?.name ?? filePath}`,
          },
          ...events,
        ].slice(0, 10));

        return filePath;
      },
    },
    os: {
      tmpdir(): string {
        const hostTmpdir = resolveHostTmpdir();
        if (hostTmpdir) {
          return hostTmpdir();
        }

        return resolveRuntimeTempDir();
      },
    },
    dialog: {
      async showSaveDialog(options: { defaultPath?: string }): Promise<{ canceled: boolean; filePath?: string }> {
        const hostSaveDialog = resolveHostSaveDialog();
        if (hostSaveDialog) {
          return hostSaveDialog(options);
        }

        const browserPrompt = resolveBrowserPrompt();
        if (!browserPrompt) {
          return { canceled: true };
        }

        const suggestedPath = String(options?.defaultPath ?? 'new-file.txt');
        const selectedPath = browserPrompt('Save file as', suggestedPath);
        if (!selectedPath) {
          return { canceled: true };
        }

        return { canceled: false, filePath: selectedPath };
      },
    },
  } as HostEagleRuntime;
}

/**
 * Resolve Eagle's native item.addFromPath method when running inside Eagle.
 */
function resolveHostAddFromPath(): ((filePath: string, options?: { name?: string }) => Promise<string>) | null {
  if (typeof eagle !== 'undefined' && typeof eagle.item?.addFromPath === 'function') {
    return eagle.item.addFromPath.bind(eagle.item);
  }

  return null;
}

/**
 * Resolve Eagle's native temporary directory helper when running inside Eagle.
 */
function resolveHostTmpdir(): (() => string) | null {
  if (typeof eagle !== 'undefined' && typeof eagle.os?.tmpdir === 'function') {
    return eagle.os.tmpdir.bind(eagle.os);
  }

  return null;
}

/**
 * Resolve a runtime temporary directory for the preview shell fallback.
 */
function resolveRuntimeTempDir(): string {
  const runtimeRequire = resolveRuntimeRequire();
  if (runtimeRequire) {
    const osModule = runtimeRequire('os') as { tmpdir(): string };
    return osModule.tmpdir();
  }

  throw new Error('No temporary directory is available from Eagle or the runtime host.');
}

/**
 * Resolve runtime require when the preview shell exposes CommonJS access.
 */
function resolveRuntimeRequire(): ((moduleName: string) => unknown) | null {
  const runtimeWindow = typeof window !== 'undefined' ? window as Window & { require?: (moduleName: string) => unknown } : null;
  if (runtimeWindow?.require) {
    return runtimeWindow.require;
  }

  try {
    return Function('return typeof require !== "undefined" ? require : null')() as ((moduleName: string) => unknown) | null;
  } catch {
    return null;
  }
}

/**
 * Resolve the native Eagle save dialog when the shell is running inside Eagle.
 */
function resolveHostSaveDialog(): ((options: { defaultPath?: string }) => Promise<{ canceled: boolean; filePath?: string }>) | null {
  if (typeof eagle !== 'undefined' && typeof eagle.dialog?.showSaveDialog === 'function') {
    return eagle.dialog.showSaveDialog.bind(eagle.dialog);
  }

  return null;
}

/**
 * Resolve a browser prompt fallback only for environments that still support it.
 */
function resolveBrowserPrompt(): ((message?: string, defaultValue?: string) => string | null) | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
    return null;
  }

  const runtimeWindow = window as Window & { process?: { versions?: { electron?: string } } };
  if (runtimeWindow.process?.versions?.electron) {
    return null;
  }

  return window.prompt.bind(window);
}

/**
 * Clone the activated plugin surface so React re-renders after runtime mutations.
 */
export function cloneActivatedPlugin(plugin: ActivatedPlugin): ActivatedPlugin {
  return {
    ...plugin,
    slots: { ...plugin.slots },
  };
}

interface PluginWindowProps {
  plugin: InstalledPluginRecord;
  activatedPlugin: ActivatedPlugin | null;
  onClosePlugin: () => void;
  syncPluginView: () => void;
}

/**
 * Render the active plugin window inside the installed tab.
 */
export function PluginWindow({
  plugin,
  activatedPlugin,
  onClosePlugin,
  syncPluginView,
}: PluginWindowProps): JSX.Element {
  return (
    <div className="flex min-h-full flex-col text-foreground">
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-4">
        <div className="flex flex-col">
          <div className="text-sm font-semibold text-foreground">{plugin.name}</div>
          <div className="text-xs text-muted-foreground">{plugin.id} · v{plugin.version} · {plugin.source === 'local' ? 'local' : plugin.bucketId ?? plugin.source}</div>
        </div>
        <Badge className="rounded-md" variant="outline">live</Badge>
        <ShellButton className="ml-auto" label="close" onClick={onClosePlugin} />
      </div>
      <div className="flex-1 p-4 md:p-5">
        <section className="min-h-full min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
          {activatedPlugin ? (
            renderUiNode(activatedPlugin.parsed.ui, activatedPlugin, syncPluginView)
          ) : (
            <EmptyState title={`${plugin.name} is running`} description="loading plugin window..." compact />
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Render one parsed or template-bound UI node.
 */
export function renderUiNode(node: UiNode, activated: ActivatedPlugin, syncView: () => void): JSX.Element {
  const nodeKind = inferNodeKind(node);

  if (node.layout === 'container') {
    return (
      <section className="space-y-4">
        {node.children?.map((child, index) => (
          <div key={`container-${index}`}>{renderUiNode(child, activated, syncView)}</div>
        ))}
      </section>
    );
  }

  if (nodeKind === 'header') {
    return (
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{String(node.title ?? '')}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{String(node.subtitle ?? '')}</p>
      </header>
    );
  }

  if (nodeKind === 'row') {
    return (
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {node.children?.map((child, index) => (
          <div key={`row-${index}`} className={child.flex ? 'flex-1' : ''}>{renderUiNode(child, activated, syncView)}</div>
        ))}
      </div>
    );
  }

  if (nodeKind === 'input' && typeof node.slot === 'string') {
    return <SlotInput node={node} activated={activated} syncView={syncView} />;
  }

  if (nodeKind === 'button') {
    return <ActionButton node={node} activated={activated} syncView={syncView} />;
  }

  if (nodeKind === 'card-list' && typeof node.slot === 'string') {
    const renderedItems = Array.isArray(activated.slots[node.slot]?.rendered) ? activated.slots[node.slot].rendered as UiNode[] : [];

    if (!renderedItems.length) {
      return (
        <section className="rounded-xl border border-dashed border-border bg-muted/35 p-8 text-center text-sm text-muted-foreground">
          {String(node.empty ?? 'Nothing to show')}
        </section>
      );
    }

    return (
      <section className="grid gap-3">
        {renderedItems.map((item, index) => (
          <div key={`card-${index}`}>{renderUiNode(item, activated, syncView)}</div>
        ))}
      </section>
    );
  }

  if (nodeKind === 'card') {
    return (
      <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{String(node.title ?? '')}</h3>
            {node.subtitle ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{String(node.subtitle)}</p> : null}
          </div>
          {typeof node.content === 'object' && node.content !== null && !Array.isArray(node.content) ? renderUiNode(node.content as UiNode, activated, syncView) : null}
          {Array.isArray(node.actions) ? (
            <div className="flex flex-wrap gap-2">
              {node.actions.map((action, index) => (
                <div key={`action-${index}`}>{renderUiNode(action, activated, syncView)}</div>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  if (nodeKind === 'text') {
    return <p className="text-sm leading-6 text-muted-foreground">{String(node.value ?? '')}</p>;
  }

  if (nodeKind === 'badge') {
    return <Badge className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${badgeClassName(String(node.variant ?? 'neutral'))}`}>{String(node.text ?? '')}</Badge>;
  }

  return <div className="text-sm text-muted-foreground">Unsupported node: {String(nodeKind ?? node.type ?? node.layout ?? 'unknown')}</div>;
}

/**
 * Infer the effective render kind for one UI node, including shorthand template actions.
 */
function inferNodeKind(node: UiNode): string | undefined {
  if (typeof node.type === 'string' && node.type) {
    return node.type;
  }

  if (typeof node.layout === 'string' && node.layout === 'container') {
    return 'container';
  }

  if (node.onClick || (typeof node.text === 'string' && typeof node.variant === 'string')) {
    return 'button';
  }

  return undefined;
}

/**
 * Render one runtime-wired slot input.
 */
function SlotInput({ node, activated, syncView }: { node: UiNode; activated: ActivatedPlugin; syncView: () => void }): JSX.Element {
  const [value, setValue] = useState('');

  /**
   * Forward one input change into the runtime slot handler.
   */
  async function handleChange(nextValue: string): Promise<void> {
    setValue(nextValue);
    if (node.onInput) {
      await invokeRuntimeTuple(activated.peagle, [node.onInput[0], node.onInput[1], [nextValue], node.onInput[3] ?? {}]);
    } else {
      await activated.peagle.slot(String(node.slot)).onInput?.(nextValue);
    }
    syncView();
  }

  return (
    <Input
      className="w-full"
      value={value}
      placeholder={String(node.placeholder ?? '')}
      onChange={(event) => {
        void handleChange(event.target.value);
      }}
    />
  );
}

/**
 * Render one runtime-wired action button.
 */
function ActionButton({ node, activated, syncView }: { node: UiNode; activated: ActivatedPlugin; syncView: () => void }): JSX.Element {
  /**
   * Invoke the button tuple against the activated runtime.
   */
  async function handleClick(): Promise<void> {
    if (node.onClick) {
      await invokeRuntimeTuple(activated.peagle, node.onClick);
      syncView();
    }
  }

  return (
    <Button
      className={buttonClassName(String(node.variant ?? 'primary'))}
      onClick={() => {
        void handleClick();
      }}
      type="button"
      variant="outline"
    >
      {String(node.text ?? 'Action')}
    </Button>
  );
}

/**
 * Invoke one UI tuple against the activated runtime.
 */
/**
 * Resolve the badge palette for one variant.
 */
function badgeClassName(variant: string): string {
  if (variant === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200';
  }

  if (variant === 'error') {
    return 'border-red-500/30 bg-red-500/15 text-red-200';
  }

  return 'border-border bg-secondary text-secondary-foreground';
}

/**
 * Resolve the button palette for one runtime action variant.
 */
function buttonClassName(variant: string): string {
  if (variant === 'secondary') {
    return 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground';
  }

  if (variant === 'warning') {
    return 'border-amber-500/30 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25';
  }

  if (variant === 'error') {
    return 'border-red-500/30 bg-red-500/15 text-red-200 hover:bg-red-500/25';
  }

  return 'border-primary bg-primary text-primary-foreground hover:bg-primary/90';
}