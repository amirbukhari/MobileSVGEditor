import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { countPathAnchors, simplifyPathD, simplifyPoints } from '../lib/simplify';
import type { PathShape, PolyShape } from '../types';

const MAX_TOLERANCE_FACTOR = 0.02;
const DEFAULT_STRENGTH = 30;

export function SimplifySheet() {
  const simplifyOpen = useEditorStore((s) => s.simplifyOpen);
  const setSimplifyOpen = useEditorStore((s) => s.setSimplifyOpen);
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const doc = useEditorStore((s) => s.doc);
  const updateGeometryLive = useEditorStore((s) => s.updateGeometryLive);
  const commitPending = useEditorStore((s) => s.commitPending);
  const discardPending = useEditorStore((s) => s.discardPending);

  const shape = shapes.find((s) => s.id === selectedId) as PathShape | PolyShape | undefined;
  const original = useRef<{ d?: string; points?: [number, number][] } | null>(null);
  const [strength, setStrength] = useState(DEFAULT_STRENGTH);

  const applyStrength = (value: number, targetId: string) => {
    setStrength(value);
    const epsilon = (value / 100) * MAX_TOLERANCE_FACTOR * Math.max(doc.width, doc.height);
    if (original.current!.d !== undefined) {
      updateGeometryLive(targetId, { d: simplifyPathD(original.current!.d, epsilon) });
    } else {
      updateGeometryLive(targetId, { points: simplifyPoints(original.current!.points!, epsilon) });
    }
  };

  useEffect(() => {
    if (!simplifyOpen || !shape) return;
    original.current = shape.type === 'path' ? { d: shape.d } : { points: shape.points };
    applyStrength(DEFAULT_STRENGTH, shape.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simplifyOpen, shape?.id]);

  if (!simplifyOpen || !shape || !original.current) return null;

  const beforeCount =
    original.current.d !== undefined ? countPathAnchors(original.current.d) : original.current.points!.length;

  const afterCount = shape.type === 'path' ? countPathAnchors(shape.d) : shape.points.length;

  const close = (commit: boolean) => {
    if (commit) commitPending();
    else discardPending();
    original.current = null;
    setStrength(DEFAULT_STRENGTH);
    setSimplifyOpen(false);
  };

  return (
    <div className="sheet-backdrop" onClick={() => close(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>Simplify Points</h2>
          <button className="icon-btn" onClick={() => close(false)}>
            ✕
          </button>
        </div>

        <p className="simplify-count">
          {beforeCount} → <strong>{afterCount}</strong> points
        </p>

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={strength}
          onChange={(e) => applyStrength(Number(e.target.value), shape.id)}
          className="opacity-slider full"
        />
        <div className="simplify-labels">
          <span>Keep detail</span>
          <span>Simplify more</span>
        </div>

        <div className="export-actions">
          <button className="btn btn-secondary" onClick={() => close(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => close(true)}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
