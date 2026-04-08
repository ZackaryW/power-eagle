import type { InvocationNamespace, InvocationTuple, UiNode } from '../types/plugin';

/**
 * Parse a ui.json payload into a normalized runtime tree.
 */
export function parseUiDefinition(rawValue: unknown): UiNode {
  if (!isRecord(rawValue)) {
    throw new Error('ui.json must contain an object root.');
  }

  return normalizeUiNode(rawValue, 'ui');
}

/**
 * Normalize one UI node and recursively process its nested nodes.
 */
function normalizeUiNode(rawNode: Record<string, unknown>, nodePath: string): UiNode {
  const normalized: UiNode = { ...rawNode };

  if (rawNode.onClick !== undefined) {
    normalized.onClick = normalizeInvocationTuple(rawNode.onClick, `${nodePath}.onClick`);
  }

  if (rawNode.onInput !== undefined) {
    normalized.onInput = normalizeInvocationTuple(rawNode.onInput, `${nodePath}.onInput`);
  }

  if (Array.isArray(rawNode.children)) {
    normalized.children = rawNode.children.map((child, index) => normalizeUiChild(child, `${nodePath}.children[${index}]`));
  }

  if (Array.isArray(rawNode.actions)) {
    normalized.actions = rawNode.actions.map((child, index) => normalizeUiChild(child, `${nodePath}.actions[${index}]`));
  }

  if (isRecord(rawNode.content)) {
    normalized.content = normalizeUiNode(rawNode.content, `${nodePath}.content`);
  }

  return normalized;
}

/**
 * Normalize one nested UI child.
 */
function normalizeUiChild(rawChild: unknown, nodePath: string): UiNode {
  if (!isRecord(rawChild)) {
    throw new Error(`${nodePath} must be an object.`);
  }

  return normalizeUiNode(rawChild, nodePath);
}

/**
 * Normalize one invocation tuple from ui.json.
 */
function normalizeInvocationTuple(rawTuple: unknown, nodePath: string): InvocationTuple {
  if (!Array.isArray(rawTuple) || rawTuple.length < 2) {
    throw new Error(`${nodePath} must be a tuple of at least [namespace, functionName].`);
  }

  const namespace = rawTuple[0];
  const functionName = rawTuple[1];
  const args = rawTuple[2];
  const kwargs = rawTuple[3];

  if (!isNamespace(namespace)) {
    throw new Error(`${nodePath}[0] must be local, ext, or eagle.`);
  }

  if (typeof functionName !== 'string' || !functionName.trim()) {
    throw new Error(`${nodePath}[1] must be a non-empty function path.`);
  }

  if (args !== undefined && !Array.isArray(args)) {
    throw new Error(`${nodePath}[2] must be an array when provided.`);
  }

  if (kwargs !== undefined && !isRecord(kwargs)) {
    throw new Error(`${nodePath}[3] must be an object when provided.`);
  }

  return [namespace, functionName, args as unknown[] | undefined, kwargs as Record<string, unknown> | undefined];
}

/**
 * Check whether an unknown value is one supported invocation namespace.
 */
function isNamespace(value: unknown): value is InvocationNamespace {
  return value === 'local' || value === 'ext' || value === 'eagle';
}

/**
 * Check whether an unknown value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}