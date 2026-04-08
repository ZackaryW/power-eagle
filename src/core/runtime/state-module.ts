const REACTIVE_STATE_META = Symbol.for('peagle.reactive.state.meta');

interface ReactiveStateMeta {
  slotMapping: Record<string, string>;
  dirtySlots: Set<string>;
  batchDepth: number;
  notify?: (slotName: string) => void;
}

type ReactiveStateContainer = Record<string, unknown> & {
  [REACTIVE_STATE_META]?: ReactiveStateMeta;
};

/**
 * Create a reactive state object with slot mappings but without a bound runtime yet.
 */
export function reactive<T extends Record<string, unknown>>(initialState: T, slotMapping: Record<string, string>): T {
  const target: ReactiveStateContainer = { ...initialState };
  target[REACTIVE_STATE_META] = {
    slotMapping,
    dirtySlots: new Set<string>(),
    batchDepth: 0,
  };

  return new Proxy(target, {
    get(currentTarget, property, receiver) {
      return Reflect.get(currentTarget, property, receiver);
    },
    set(currentTarget, property, value, receiver) {
      const didSet = Reflect.set(currentTarget, property, value, receiver);
      const meta = currentTarget[REACTIVE_STATE_META];
      if (meta && typeof property === 'string' && meta.slotMapping[property]) {
        const slotName = meta.slotMapping[property];
        if (meta.batchDepth > 0) {
          meta.dirtySlots.add(slotName);
        } else {
          meta.notify?.(slotName);
        }
      }

      return didSet;
    },
  }) as T;
}

/**
 * Attach one runtime notification callback to a reactive state instance.
 */
export function attachReactiveState(state: Record<string, unknown>, notify: (slotName: string) => void): void {
  const meta = getReactiveMeta(state);
  meta.notify = notify;
}

/**
 * Run one batch mutation transaction against a reactive state instance.
 */
export function runReactiveBatch<T>(state: Record<string, unknown>, callback: () => T): T {
  const meta = getReactiveMeta(state);
  meta.batchDepth += 1;

  try {
    return callback();
  } finally {
    meta.batchDepth -= 1;
    if (meta.batchDepth === 0) {
      const dirtySlots = Array.from(meta.dirtySlots);
      meta.dirtySlots.clear();
      dirtySlots.forEach((slotName) => meta.notify?.(slotName));
    }
  }
}

/**
 * Read the slot mapping metadata from one reactive state instance.
 */
export function getReactiveSlotMapping(state: Record<string, unknown>): Record<string, string> {
  return { ...getReactiveMeta(state).slotMapping };
}

/**
 * Get the internal reactive metadata for one state instance.
 */
function getReactiveMeta(state: Record<string, unknown>): ReactiveStateMeta {
  const meta = (state as ReactiveStateContainer)[REACTIVE_STATE_META];
  if (!meta) {
    throw new Error('Expected a reactive state object created by peagle/state.');
  }

  return meta;
}