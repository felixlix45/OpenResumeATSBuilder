/**
 * Drag-and-drop reordering for a list.
 *
 * WCAG 2.2 SC 2.5.7 (Dragging Movements) requires a single-pointer alternative to
 * dragging, and keyboard equivalence does *not* satisfy it — the two are assessed
 * independently. So every list using this hook must also render visible
 * move-up / move-down buttons; the hook only adds the drag affordance on top.
 *
 * Native HTML5 drag events are used instead of a library: they work in every
 * target browser, cost nothing, and degrade to the buttons on touch devices.
 */

import { useCallback, useRef, useState } from 'react';

export interface ReorderHandlers {
  draggable: true;
  onDragStart: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  'data-dragging'?: 'true';
  'data-drop-target'?: 'true';
}

export interface ListReorder {
  /** Spread onto the draggable row. */
  itemProps: (index: number) => ReorderHandlers;
  /** True while a drag is in progress anywhere in this list. */
  isDragging: boolean;
  /** Index currently being dragged, or null. */
  draggingIndex: number | null;
}

export function useListReorder(count: number, onMove: (from: number, to: number) => void): ListReorder {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const draggingRef = useRef<number | null>(null);

  const finish = useCallback(() => {
    setDraggingIndex(null);
    setOverIndex(null);
    draggingRef.current = null;
  }, []);

  const itemProps = useCallback(
    (index: number): ReorderHandlers => ({
      draggable: true,
      onDragStart: (event) => {
        draggingRef.current = index;
        setDraggingIndex(index);
        event.dataTransfer.effectAllowed = 'move';
        // Firefox refuses to start a drag without data on the transfer.
        event.dataTransfer.setData('text/plain', String(index));
      },
      onDragOver: (event) => {
        if (draggingRef.current === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setOverIndex(index);
      },
      onDragLeave: () => {
        setOverIndex((current) => (current === index ? null : current));
      },
      onDrop: (event) => {
        event.preventDefault();
        const from = draggingRef.current;
        if (from === null || from === index) {
          finish();
          return;
        }
        onMove(from, index);
        finish();
      },
      onDragEnd: finish,
      ...(draggingIndex === index ? { 'data-dragging': 'true' as const } : {}),
      ...(overIndex === index && draggingIndex !== null && draggingIndex !== index
        ? { 'data-drop-target': 'true' as const }
        : {}),
    }),
    [draggingIndex, overIndex, onMove, finish, count],
  );

  return { itemProps, isDragging: draggingIndex !== null, draggingIndex };
}
