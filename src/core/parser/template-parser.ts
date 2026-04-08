import type { RenderTemplate } from '../types/plugin';

/**
 * Parse one render template JSON payload.
 */
export function parseRenderTemplate(rawValue: unknown): RenderTemplate {
  if (!isRecord(rawValue)) {
    throw new Error('render template roots must be objects.');
  }

  return rawValue;
}

/**
 * Bind one render template against one item of slot data.
 */
export function bindRenderTemplate(template: unknown, item: Record<string, unknown>): unknown {
  if (Array.isArray(template)) {
    return template.map((entry) => bindRenderTemplate(entry, item));
  }

  if (isRecord(template)) {
    return Object.fromEntries(
      Object.entries(template).map(([key, value]) => [key, bindRenderTemplate(value, item)]),
    );
  }

  if (typeof template === 'string') {
    return bindTemplateString(template, item);
  }

  return template;
}

/**
 * Bind one mustache-style string against one item.
 */
function bindTemplateString(template: string, item: Record<string, unknown>): unknown {
  const wholeMatch = template.match(/^\{\{\s*([^}]+)\s*\}\}$/);
  if (wholeMatch) {
    return resolveBinding(wholeMatch[1], item);
  }

  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression) => String(resolveBinding(expression, item) ?? ''));
}

/**
 * Resolve one binding expression against one item.
 */
function resolveBinding(expression: string, item: Record<string, unknown>): unknown {
  if (expression === 'self') {
    return item;
  }

  return item[expression];
}

/**
 * Check whether an unknown value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}