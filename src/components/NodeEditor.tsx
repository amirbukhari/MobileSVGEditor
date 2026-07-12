import { useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PathShape, PolyShape, Shape } from '../types';
import { boundsCenter, localBounds, localToWorld, worldToLocal } from '../lib/geometry';
import { clientToSvgPoint } from '../lib/svgPoint';
import { isInsertableSegment, parsePath, serializePath, type PathCommand, type PathPoint } from '../lib/pathData';
import { useEditorStore } from '../store/editorStore';

interface Props {
  shape: PathShape | PolyShape;
  svgRef: React.RefObject<SVGSVGElement | null>;
  docSize: { width: number; height: number };
  zoom: number;
}

const MOVE_THRESHOLD = 3;

export function NodeEditor({ shape, svgRef, zoom }: Props) {
  const updateGeometryLive = useEditorStore((s) => s.updateGeometryLive);
  const commitPending = useEditorStore((s) => s.commitPending);
  const addNode = useEditorStore((s) => s.addNode);
  const selectNode = useEditorStore((s) => s.selectNode);
  const selectedNodeIndex = useEditorStore((s) => s.selectedNodeIndex);
  const dragRef = useRef<{
    kind: 'path-anchor' | 'path-control' | 'poly';
    cmdIndex: number;
    controlIndex?: number;
    pointIndex?: number;
    moved: boolean;
    startClient: { x: number; y: number };
  } | null>(null);

  const center = boundsCenter(localBounds(shape));

  // Handle sizes are expressed in screen pixels and divided by the current
  // zoom so they stay a constant size on screen no matter how far the canvas
  // is zoomed or how much the shape itself is scaled.
  const r = 6 / zoom;
  const cr = 5 / zoom;
  const hitR = 15 / zoom;

  const commands: PathCommand[] | null = useMemo(
    () => (shape.type === 'path' ? parsePath(shape.d) : null),
    [shape]
  );

  const toWorld = (p: PathPoint | { x: number; y: number }) => localToWorld(p, shape.transform, center);

  const toLocal = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const world = clientToSvgPoint(svg, e.clientX, e.clientY);
    return worldToLocal(world, shape.transform, center);
  };

  const beginDrag = (info: NonNullable<typeof dragRef.current>) => (e: ReactPointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { ...info, startClient: { x: e.clientX, y: e.clientY }, moved: false };
  };

  const onMove = (e: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dist = Math.hypot(e.clientX - drag.startClient.x, e.clientY - drag.startClient.y);
    if (!drag.moved && dist < MOVE_THRESHOLD) return;
    drag.moved = true;
    const local = toLocal(e);

    if (drag.kind === 'poly') {
      const poly = shape as PolyShape;
      const points = poly.points.map((p, i) => (i === drag.pointIndex ? ([local.x, local.y] as [number, number]) : p));
      updateGeometryLive(shape.id, { points } as Partial<Shape>);
      return;
    }

    if (!commands) return;
    const next = commands.map((c) => ({ ...c, point: c.point ? { ...c.point } : undefined, controls: c.controls?.map((cc) => ({ ...cc })) }));
    const cmd = next[drag.cmdIndex];
    if (drag.kind === 'path-anchor' && cmd.point) {
      cmd.point.x = local.x;
      cmd.point.y = local.y;
    } else if (drag.kind === 'path-control' && cmd.controls && drag.controlIndex !== undefined) {
      cmd.controls[drag.controlIndex].x = local.x;
      cmd.controls[drag.controlIndex].y = local.y;
    }
    updateGeometryLive(shape.id, { d: serializePath(next) } as Partial<Shape>);
  };

  const onUp = (selectIdx: number | null) => (e: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dragRef.current;
    if (drag?.moved) commitPending();
    else if (selectIdx !== null) selectNode(selectIdx);
    dragRef.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  // ---- Polygon / polyline ----
  if (shape.type === 'polygon' || shape.type === 'polyline') {
    const pts = shape.points.map((p) => toWorld({ x: p[0], y: p[1] }));
    const closed = shape.type === 'polygon';
    const segCount = closed ? pts.length : pts.length - 1;
    return (
      <g className="node-editor">
        {Array.from({ length: segCount }, (_, i) => {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          return (
            <line
              key={`seg-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="node-segment"
              strokeWidth={hitR}
              onPointerDown={(e) => {
                e.stopPropagation();
                addNode(shape.id, i);
              }}
            />
          );
        })}
        {pts.map((p, i) => (
          <g key={`pt-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hitR}
              className="node-hit"
              onPointerDown={beginDrag({ kind: 'poly', cmdIndex: -1, pointIndex: i, moved: false, startClient: { x: 0, y: 0 } })}
              onPointerMove={onMove}
              onPointerUp={onUp(i)}
              onPointerCancel={onUp(null)}
            />
            <circle cx={p.x} cy={p.y} r={r} className={`node-point ${selectedNodeIndex === i ? 'selected' : ''}`} pointerEvents="none" />
          </g>
        ))}
      </g>
    );
  }

  // ---- Path ----
  if (!commands) return null;

  const segD = (i: number): string => {
    const prev = commands[i - 1].point!;
    const seg = commands[i];
    const p = toWorld(seg.point!);
    const w0 = toWorld(prev);
    if (seg.type === 'C' && seg.controls) {
      const c1 = toWorld(seg.controls[0]);
      const c2 = toWorld(seg.controls[1]);
      return `M${w0.x},${w0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p.x},${p.y}`;
    }
    if (seg.type === 'Q' && seg.controls) {
      const c1 = toWorld(seg.controls[0]);
      return `M${w0.x},${w0.y} Q${c1.x},${c1.y} ${p.x},${p.y}`;
    }
    return `M${w0.x},${w0.y} L${p.x},${p.y}`;
  };

  return (
    <g className="node-editor">
      {commands.map((_, i) =>
        isInsertableSegment(commands, i) ? (
          <path
            key={`seg-${i}`}
            d={segD(i)}
            className="node-segment"
            strokeWidth={hitR}
            onPointerDown={(e) => {
              e.stopPropagation();
              addNode(shape.id, i);
            }}
          />
        ) : null
      )}
      {commands.map((c, i) => {
        if (c.type === 'Z' || !c.point) return null;
        const anchor = toWorld(c.point);
        const controlEls = (c.controls ?? []).map((ctrl, ci) => {
          const cw = toWorld(ctrl);
          return (
            <g key={`ctrl-${i}-${ci}`}>
              <line x1={cw.x} y1={cw.y} x2={anchor.x} y2={anchor.y} className="control-line" vectorEffect="non-scaling-stroke" />
              <circle
                cx={cw.x}
                cy={cw.y}
                r={cr}
                className="node-control"
                onPointerDown={beginDrag({ kind: 'path-control', cmdIndex: i, controlIndex: ci, moved: false, startClient: { x: 0, y: 0 } })}
                onPointerMove={onMove}
                onPointerUp={onUp(null)}
                onPointerCancel={onUp(null)}
              />
            </g>
          );
        });
        return (
          <g key={`node-${i}`}>
            {controlEls}
            <circle
              cx={anchor.x}
              cy={anchor.y}
              r={hitR}
              className="node-hit"
              onPointerDown={beginDrag({ kind: 'path-anchor', cmdIndex: i, moved: false, startClient: { x: 0, y: 0 } })}
              onPointerMove={onMove}
              onPointerUp={onUp(i)}
              onPointerCancel={onUp(null)}
            />
            <circle cx={anchor.x} cy={anchor.y} r={r} className={`node-point ${selectedNodeIndex === i ? 'selected' : ''}`} pointerEvents="none" />
          </g>
        );
      })}
    </g>
  );
}
