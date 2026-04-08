import type { SlotSnapshot, UiNode } from '../types/plugin';

/**
 * Create a slot registry from the parsed ui.json tree.
 */
export function createSlotRegistry(ui: UiNode): Record<string, SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null }> {
  const slots: Record<string, SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null }> = {};
  collectSlots(ui, slots);
  return slots;
}

/**
 * Create a map from slot names to their source ui nodes.
 */
export function createSlotNodeMap(ui: UiNode): Map<string, UiNode> {
  const slotMap = new Map<string, UiNode>();
  collectSlotNodes(ui, slotMap);
  return slotMap;
}

/**
 * Walk the UI tree and initialize slot controllers.
 */
function collectSlots(node: UiNode, slots: Record<string, SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null }>): void {
  if (typeof node.slot === 'string' && !slots[node.slot]) {
    slots[node.slot] = {
      name: node.slot,
      rendered: null,
      onInput: null,
    };
  }

  node.children?.forEach((child) => collectSlots(child, slots));
  node.actions?.forEach((child) => collectSlots(child, slots));
  if (typeof node.content === 'object' && node.content !== null && !Array.isArray(node.content)) {
    collectSlots(node.content as UiNode, slots);
  }
}

/**
 * Walk the UI tree and map slot declarations to their ui nodes.
 */
function collectSlotNodes(node: UiNode, slotMap: Map<string, UiNode>): void {
  if (typeof node.slot === 'string') {
    slotMap.set(node.slot, node);
  }

  node.children?.forEach((child) => collectSlotNodes(child, slotMap));
  node.actions?.forEach((child) => collectSlotNodes(child, slotMap));
  if (typeof node.content === 'object' && node.content !== null && !Array.isArray(node.content)) {
    collectSlotNodes(node.content as UiNode, slotMap);
  }
}