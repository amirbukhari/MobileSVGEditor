import { useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PathShape, PolyShape, Shape } from '../types';
import { boundsCenter, localBounds, transformString, worldToLocal } from '../lib/geometry';
import { clientToSvgPoint } from '../lib/svgPoint';
import { parsePath, serializePath, type PathCommand } from '../lib/pathData';
import { useEditorStore } from '../store/editorStore';

interface Props {
  shape: PathShape | PolyShape;
  svgRef: React.RefObject<SVGSVGElement | null>;
  docSize: { width: number; height: number };
}

const MOVE_THRESHOLD = 3;

export function NodeEditor({ shape, svgRef, docSize }: Props) {
  const updateGeometryLive = useEditorStore((s) => s.updateGeometryLive);
  const commitPending = useEditorStore((s) => s.commitPending);
  const dragRef = useRef<{
    kind: 'path-anchor' | 'path-control' | 'poly';
    cmdIndex: number;
    controlIndex?: number;
    pointIndex?: number;
    moved: boolean;
    startClient: { x: number; y: number };
  } | null>(null);

  const center = boundsCenter(localBounds(shape));
  const groupTransform = transformString(shape.transform, center);
  const r = Math.max(Math.max(docSize.width, docSize.height) * 0.015, 3.5);

  const commands: PathCommand[] | null = useMemo(
    () => (shape.type === 'path' ? parsePath(shape.d) : null),
    [shape]
  );

  const toLocal = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const world = clientToSvgPoint(svg, e.clientX, e.clientY);
    return worldToLocal(world, shape.transform, center);
  };

  const beginDrag = (info: typeof dragRef.current) => (e: ReactPointerEvent<SVGCircleElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { ...info!, startClient: { x: e.clientX, y: e.clientY }, moved: false };
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

  const onUp = (e: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dragRef.current;
    if (drag?.moved) commitPending();
    dragRef.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  if (shape.type === 'polygon' || shape.type === 'polyline') {
    return (
      <g transform={groupTransform} className="node-editor">
        {shape.points.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={r}
            className="node-point"
            onPointerDown={beginDrag({ kind: 'poly', cmdIndex: -1, pointIndex: i, moved: false, startClient: { x: 0, y: 0 } })}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        ))}
      </g>
    );
  }

  if (!commands) return null;

  return (
    <g transform={groupTransform} className="node-editor">
      {commands.map((c, i) => {
        if (c.type === 'Z' || !c.point) return null;
        const controlEls = (c.controls ?? []).map((ctrl, ci) => (
          <g key={`ctrl-${i}-${ci}`}>
            <line x1={ctrl.x} y1={ctrl.y} x2={c.point!.x} y2={c.point!.y} className="control-line" vectorEffect="non-scaling-stroke" />
            <circle
              cx={ctrl.x}
              cy={ctrl.y}
              r={r * 0.8}
              className="node-control"
              onPointerDown={beginDrag({ kind: 'path-control', cmdIndex: i, controlIndex: ci, moved: false, startClient: { x: 0, y: 0 } })}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </g>
        ));
        return (
          <g key={i}>
            {controlEls}
            <circle
              cx={c.point.x}
              cy={c.point.y}
              r={r}
              className="node-point"
              onPointerDown={beginDrag({ kind: 'path-anchor', cmdIndex: i, moved: false, startClient: { x: 0, y: 0 } })}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </g>
        );
      })}
    </g>
  );
}
