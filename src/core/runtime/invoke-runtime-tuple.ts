import type { InvocationTuple, PeagleRuntime } from '../types/plugin';

/**
 * Invoke one configured runtime tuple against the active peagle facade.
 */
export async function invokeRuntimeTuple(
  peagle: PeagleRuntime,
  tuple: InvocationTuple,
  runtimeArgs?: unknown[],
): Promise<unknown> {
  const [namespace, functionName, args = [], kwargs = {}] = tuple;
  const bindingContext = createTupleBindingContext(peagle, runtimeArgs);
  const effectiveArgs = resolveInvocationArgs(args, bindingContext, runtimeArgs);
  const effectiveKwargs = resolveInvocationValue(kwargs, bindingContext) as Record<string, unknown>;

  if (namespace === 'local') {
    return peagle.local.invokeFunc(functionName, effectiveArgs, effectiveKwargs);
  }

  if (namespace === 'ext') {
    return peagle.ext.invokeFunc(functionName, effectiveArgs, effectiveKwargs);
  }

  if (functionName.startsWith('plugin.')) {
    return peagle.eagle.plugin.invokeFunc(functionName.slice('plugin.'.length), effectiveArgs, effectiveKwargs);
  }

  if (functionName.startsWith('web.')) {
    return peagle.eagle.web.invokeFunc(functionName.slice('web.'.length), effectiveArgs, effectiveKwargs);
  }

  if (functionName.startsWith('util.')) {
    return peagle.eagle.util.invokeFunc(functionName.slice('util.'.length), effectiveArgs, effectiveKwargs);
  }

  throw new Error(`eagle tuple paths must start with plugin., web., or util.: ${functionName}`);
}

interface TupleBindingContext {
  state: Record<string, unknown>;
  args: unknown[];
  input: unknown;
  value: unknown;
  self: unknown;
}

/**
 * Create one interpolation context for a runtime tuple invocation.
 */
function createTupleBindingContext(peagle: PeagleRuntime, runtimeArgs?: unknown[]): TupleBindingContext {
  const args = runtimeArgs ?? [];
  return {
    state: peagle.state.values,
    args,
    input: args[0],
    value: args[0],
    self: args[0],
  };
}

/**
 * Resolve the invocation args, preserving passthrough runtime args when no configured args exist.
 */
function resolveInvocationArgs(configuredArgs: unknown[], context: TupleBindingContext, runtimeArgs?: unknown[]): unknown[] {
  if (configuredArgs.length === 0) {
    return runtimeArgs ?? [];
  }

  return resolveInvocationValue(configuredArgs, context) as unknown[];
}

/**
 * Resolve one invocation payload recursively against runtime state and input args.
 */
function resolveInvocationValue(value: unknown, context: TupleBindingContext): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => resolveInvocationValue(entry, context));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveInvocationValue(entry, context)]),
    );
  }

  if (typeof value !== 'string') {
    return value;
  }

  return resolveInvocationString(value, context);
}

/**
 * Resolve one string payload, preserving non-string values when the whole string is one token.
 */
function resolveInvocationString(value: string, context: TupleBindingContext): unknown {
  const exactMatch = value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/u);
  if (exactMatch) {
    const resolved = lookupBindingValue(exactMatch[1], context);
    return resolved === undefined ? value : resolved;
  }

  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (match, expression: string) => {
    const resolved = lookupBindingValue(expression, context);
    return resolved === undefined ? match : String(resolved);
  });
}

/**
 * Look up one placeholder expression against the supported tuple binding scopes.
 */
function lookupBindingValue(expression: string, context: TupleBindingContext): unknown {
  const normalizedExpression = expression.trim();

  if (normalizedExpression === 'input' || normalizedExpression === 'value' || normalizedExpression === 'self') {
    return context.input;
  }

  if (normalizedExpression === 'args') {
    return context.args;
  }

  if (normalizedExpression === 'state') {
    return context.state;
  }

  if (normalizedExpression.startsWith('args.')) {
    return readPathValue(context.args, normalizedExpression.slice('args.'.length));
  }

  if (normalizedExpression.startsWith('state.')) {
    return readPathValue(context.state, normalizedExpression.slice('state.'.length));
  }

  return undefined;
}

/**
 * Read one dot-path from an object or array-like value.
 */
function readPathValue(source: unknown, path: string): unknown {
  return path
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (Array.isArray(current)) {
        const index = Number(segment);
        return Number.isInteger(index) ? current[index] : undefined;
      }

      if (isRecord(current)) {
        return current[segment];
      }

      return undefined;
    }, source);
}

/**
 * Check whether an unknown value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}