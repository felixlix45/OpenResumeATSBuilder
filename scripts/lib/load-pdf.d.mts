/** Types for the Node-side PDF loader. */

import type { Inspection } from './pdf-core.mjs';

export function inspectPdfBuffer(
  buffer: Uint8Array,
  core?: unknown,
): Promise<{ inspection: Inspection; rawBytes: Uint8Array }>;

export function loadPdfjs(): Promise<unknown>;
