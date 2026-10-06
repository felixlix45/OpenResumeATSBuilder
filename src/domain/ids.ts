/**
 * Stable, collision-resistant IDs for every editable node.
 *
 * IDs matter for more than React keys: they are what makes drag-and-drop
 * reordering, undo/redo and focus restoration safe across re-renders.
 */

let fallbackCounter = 0;

export function makeId(prefix = 'n'): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return `${prefix}_${c.randomUUID()}`;
  }
  fallbackCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${fallbackCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Returns `value` when it is a plausible non-empty id, otherwise a fresh id. */
export function ensureId(value: unknown, prefix = 'n'): string {
  if (typeof value === 'string' && value.trim().length > 0 && value.length <= 128) return value;
  return makeId(prefix);
}
