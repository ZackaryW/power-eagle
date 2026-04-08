import { bindRenderTemplate } from '../parser/template-parser';
import { invokeRuntimeTuple } from '../runtime/invoke-runtime-tuple';
import type { InvocationTuple, PeagleRuntime, RenderTemplate, SlotSnapshot, UiNode } from '../types/plugin';

/**
 * Create the built-in ext registry needed by the parser-first runtime.
 */
export function createExtRegistry(
  slots: Record<string, SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null }>,
  slotNodes: Map<string, UiNode>,
  templates: Record<string, RenderTemplate>,
  reactiveState: Record<string, unknown>,
): Map<string, (peagle: unknown, args?: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown> | unknown> {
  return new Map([
    ['utils.debounce', debouncePreset],
    ['invoke.debounced', createDebouncedInvokePreset()],
    ['file.createWithContent', createFileCreateWithContentPreset()],
    ['slot.loading', createSlotLoadingPreset(slots)],
    ['slot.render', createSlotRenderPreset(slots, slotNodes, templates)],
    ['state.set', createStateSetPreset(reactiveState)],
    ['dialog.confirm', confirmPreset],
  ]);
}

/**
 * Build the debounce preset.
 */
function debouncePreset(_peagle: unknown, args: unknown[] = [], kwargs: Record<string, unknown> = {}): (...callbackArgs: unknown[]) => Promise<unknown> {
  const waitMs = typeof args[0] === 'number' ? args[0] : 0;
  const target = kwargs.target;
  if (typeof target !== 'function') {
    throw new Error('utils.debounce requires kwargs.target to be a function.');
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...callbackArgs: unknown[]) => new Promise((resolve) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(async () => {
      resolve(await target(...callbackArgs));
    }, waitMs);
  });
}

/**
 * Build the slot.loading preset bound to the slot registry.
 */
function createSlotLoadingPreset(slots: Record<string, SlotSnapshot>): (peagle: unknown, args?: unknown[], kwargs?: Record<string, unknown>) => unknown {
  return (_peagle: unknown, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    const slotName = String(args[0]);
    const text = typeof kwargs.text === 'string' ? kwargs.text : 'Loading...';
    slots[slotName].rendered = { kind: 'loading', text };
    return slots[slotName].rendered;
  };
}

/**
 * Build the slot.render preset bound to templates and slots.
 */
function createSlotRenderPreset(
  slots: Record<string, SlotSnapshot>,
  slotNodes: Map<string, UiNode>,
  templates: Record<string, RenderTemplate>,
): (peagle: unknown, args?: unknown[], kwargs?: Record<string, unknown>) => unknown {
  return (_peagle: unknown, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    const slotName = String(args[0]);
    const slotData = Array.isArray(args[1]) ? args[1] : [];
    const templateName = typeof kwargs.template === 'string'
      ? kwargs.template
      : slotNodes.get(slotName)?.template;

    if (!templateName || !templates[templateName]) {
      slots[slotName].rendered = slotData;
      return slotData;
    }

    const rendered = slotData.map((item) => bindRenderTemplate(templates[templateName], item as Record<string, unknown>));
    slots[slotName].rendered = rendered;
    return rendered;
  };
}

/**
 * Build the state.set preset bound to one reactive state object.
 */
function createStateSetPreset(
  reactiveState: Record<string, unknown>,
): (peagle: unknown, args?: unknown[], kwargs?: Record<string, unknown>) => unknown {
  return (_peagle: unknown, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    const stateKey = typeof kwargs.key === 'string' ? kwargs.key : typeof args[0] === 'string' ? args[0] : null;
    const rawValue = args.length > 1 ? args[1] : args[0];
    if (!stateKey) {
      throw new Error('state.set requires a target state key.');
    }

    const nextValue = normalizeStateValue(rawValue, kwargs);
    reactiveState[stateKey] = nextValue;
    return nextValue;
  };
}

/**
 * Build the invoke.debounced preset for declarative delayed invocation.
 */
function createDebouncedInvokePreset(): (peagle: unknown, args?: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown> {
  const timeoutRegistry = new Map<string, ReturnType<typeof setTimeout>>();

  return async (peagle: unknown, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    const runtime = peagle as PeagleRuntime;
    const target = parseTargetTuple(kwargs.target);
    const delay = typeof kwargs.delay === 'number' ? kwargs.delay : 0;
    const debounceKey = typeof kwargs.key === 'string' ? kwargs.key : 'default';
    const existingTimeout = timeoutRegistry.get(debounceKey);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        timeoutRegistry.delete(debounceKey);
        void invokeRuntimeTuple(runtime, target, args).then(resolve);
      }, delay);
      timeoutRegistry.set(debounceKey, timeoutHandle);
    });
  };
}

/**
 * Build the file.createWithContent preset for Eagle-backed file creation flows.
 */
function createFileCreateWithContentPreset(): (peagle: unknown, args?: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown> {
  return async (peagle: unknown, _args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    const runtime = peagle as PeagleRuntime;
    const stateKey = typeof kwargs.key === 'string' ? kwargs.key : null;
    const configuredFileName = typeof kwargs.fileName === 'string'
      ? kwargs.fileName
      : typeof kwargs.name === 'string'
        ? kwargs.name
        : null;

    const fileStem = (configuredFileName ?? (stateKey ? String(runtime.state.values[stateKey] ?? '') : '')).trim();
    if (!stateKey) {
      if (!configuredFileName) {
        throw new Error('file.createWithContent requires kwargs.key, kwargs.fileName, or kwargs.name.');
      }
    }

    if (!fileStem) {
      await showNotification(runtime, {
        title: typeof kwargs.missingTitle === 'string' ? kwargs.missingTitle : 'Name Required',
        body: typeof kwargs.missingBody === 'string' ? kwargs.missingBody : 'Enter a file name first.',
      });
      return false;
    }

    const extension = normalizeDocumentExtension(kwargs.extension);
    const saveResult = await runtime.eagle.plugin.invokeFunc('dialog.showSaveDialog', [{
      title: typeof kwargs.title === 'string' ? kwargs.title : 'Create File',
      defaultPath: `${fileStem}.${extension}`,
      buttonLabel: typeof kwargs.buttonLabel === 'string' ? kwargs.buttonLabel : 'Create',
    }], {});

    if (!isRecord(saveResult) || saveResult.canceled === true || typeof saveResult.filePath !== 'string') {
      return false;
    }

    const content = buildDocumentContent(fileStem, kwargs);
    await runtime.eagle.util.invokeFunc('writeTextFile', [saveResult.filePath, content], {});

    if (kwargs.notify !== false) {
      await showNotification(runtime, {
        title: typeof kwargs.successTitle === 'string' ? kwargs.successTitle : 'File Created',
        body: typeof kwargs.successBody === 'string' ? kwargs.successBody : `Created ${fileStem}.${extension}`,
      });
    }

    return true;
  };
}

/**
 * Show one host notification using the Eagle notification option shape.
 */
async function showNotification(runtime: PeagleRuntime, options: { title: string; body: string }): Promise<void> {
  await runtime.eagle.plugin.invokeFunc('notification.show', [options], {});
}

/**
 * Normalize an assigned state value using simple declarative string transforms.
 */
function normalizeStateValue(value: unknown, kwargs: Record<string, unknown>): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  let normalized = value;
  if (kwargs.trim === true) {
    normalized = normalized.trim();
  }

  if (kwargs.stripLeadingDots === true) {
    normalized = normalized.replace(/^\.+/u, '');
  }

  if (kwargs.lowerCase === true) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Build the confirm preset used by later actions.
 */
function confirmPreset(): boolean {
  return true;
}

/**
 * Parse one nested invocation target from ext preset kwargs.
 */
function parseTargetTuple(value: unknown): InvocationTuple {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error('invoke.debounced requires kwargs.target to be an invocation tuple.');
  }

  return [
    value[0] as InvocationTuple[0],
    String(value[1]),
    Array.isArray(value[2]) ? value[2] : [],
    isRecord(value[3]) ? value[3] : {},
  ];
}

/**
 * Check whether an unknown value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalize one document file extension.
 */
function normalizeDocumentExtension(extension: unknown): string {
  const normalized = typeof extension === 'string' ? extension.trim().replace(/^\.+/u, '').toLowerCase() : '';
  return normalized || 'txt';
}

/**
 * Build the written document content from one JSON-configured template.
 */
function buildDocumentContent(fileStem: string, kwargs: Record<string, unknown>): string {
  const extension = normalizeDocumentExtension(kwargs.extension);
  if (isRecord(kwargs.contentByExtension)) {
    const mappedContent = kwargs.contentByExtension[extension];
    if (typeof mappedContent === 'string') {
      return mappedContent
        .replace(/\{\{\s*value\s*\}\}/gu, fileStem)
        .replace(/\{\{\s*name\s*\}\}/gu, fileStem)
        .replace(/\{\{\s*title\s*\}\}/gu, fileStem);
    }
  }

  if (typeof kwargs.contentTemplate === 'string') {
    return kwargs.contentTemplate
      .replace(/\{\{\s*value\s*\}\}/gu, fileStem)
      .replace(/\{\{\s*name\s*\}\}/gu, fileStem)
      .replace(/\{\{\s*title\s*\}\}/gu, fileStem);
  }

  if (typeof kwargs.content === 'string') {
    return kwargs.content;
  }

  return '';
}