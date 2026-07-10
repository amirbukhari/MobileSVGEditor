import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Shape } from '../types';
import { boundsCenter, localBounds } from '../lib/geometry';
import { buildHandles, applyRotate, applyScale, type DragStart, type HandleSpec } from '../lib/transformMath';
import { clientToSvgPoint } from '../lib/svgPoint';
import { useEditorStore } from '../store/editorStore';

interface Props {
  shape: Shape;
  svgRef: React.RefObject<SVGSVGElement | null>;
  docSize: { width: number; height: number };
}

const MOVE_THRESHOLD = 3;

export function TransformHandles({ shape, svgRef, docSize }: Props) {
  const updateTransform = useEditorStore((s) => s.updateTransform);
  const commitTransform = useEditorStore((s) => s.commitTransform);
  const dragRef = useRef<{
    start: DragStart;
    handle: HandleSpec;
    moved: boolean;
    startClient: { x: number; y: number };
  } | null>(null);

  const bbox = localBounds(shape);
  const center = boundsCenter(bbox);
  const rotateOffset = Math.max(docSize.width, docSize.height) * 0.09;
  const handleR = Math.max(Math.max(docSize.width, docSize.height) * 0.02, 4);
  const handles = buildHandles(bbox, rotateOffset);

  const { scaleX, scaleY, rotate, x, y } = shape.transform;
  const groupTransform = `translate(${x + center.x} ${y + center.y}) rotate(${rotate})`;

  const scaledPoint = (ox: number, oy: number) => ({ x: scaleX * ox, y: scaleY * oy });

  const corners = ['nw', 'ne', 'se', 'sw'].map((id) => handles.find((h) => h.id === id)!);
  const scaledCorners = corners.map((h) => scaledPoint(h.ox, h.oy));
  const minX = Math.min(...scaledCorners.map((p) => p.x));
  const maxX = Math.max(...scaledCorners.map((p) => p.x));
  const minY = Math.min(...scaledCorners.map((p) => p.y));
  const maxY = Math.max(...scaledCorners.map((p) => p.y));
  const rotateHandle = handles.find((h) => h.id === 'rotate')!;
  const rotatePt = scaledPoint(rotateHandle.ox, rotateHandle.oy);
  const rotateTopMidY = Math.min(minY, 0);

  const onHandlePointerDown = (handle: HandleSpec) => (e: ReactPointerEvent<SVGCircleElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const pointerRoot = clientToSvgPoint(svg, e.clientX, e.clientY);
    const centerWorld = { x: shape.transform.x + center.x, y: shape.transform.y + center.y };
    dragRef.current = {
      start: { center: centerWorld, pointerRoot, transform: { ...shape.transform } },
      handle,
      moved: false,
      startClient: { x: e.clientX, y: e.clientY },
    };
  };

  const onHandlePointerMove = (e: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const distClient = Math.hypot(e.clientX - drag.startClient.x, e.clientY - drag.startClient.y);
    if (!drag.moved && distClient < MOVE_THRESHOLD) return;
    drag.moved = true;
    const pointerRoot = clientToSvgPoint(svg, e.clientX, e.clientY);
    const patch =
      drag.handle.kind === 'rotate'
        ? applyRotate(drag.start, pointerRoot)
        : applyScale(drag.start, pointerRoot, drag.handle);
    updateTransform(shape.id, patch, false);
  };

  const onHandlePointerUp = (e: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dragRef.current;
    if (drag?.moved) commitTransform();
    dragRef.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  return (
    <g transform={groupTransform} className="transform-handles">
      <rect
        x={minX}
        y={minY}
        width={maxX - minX}
        height={maxY - minY}
        className="selection-box"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={0}
        y1={rotateTopMidY}
        x2={rotatePt.x}
        y2={rotatePt.y}
        className="rotate-connector"
        vectorEffect="non-scaling-stroke"
      />
      {corners.map((h) => {
        const p = scaledPoint(h.ox, h.oy);
        return (
          <circle
            key={h.id}
            cx={p.x}
            cy={p.y}
            r={handleR}
            className="handle handle-corner"
            onPointerDown={onHandlePointerDown(h)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          />
        );
      })}
      {['n', 's', 'w', 'e'].map((id) => {
        const h = handles.find((hh) => hh.id === id)!;
        const p = scaledPoint(h.ox, h.oy);
        return (
          <circle
            key={h.id}
            cx={p.x}
            cy={p.y}
            r={handleR * 0.8}
            className="handle handle-edge"
            onPointerDown={onHandlePointerDown(h)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          />
        );
      })}
      <circle
        cx={rotatePt.x}
        cy={rotatePt.y}
        r={handleR}
        className="handle handle-rotate"
        onPointerDown={onHandlePointerDown(rotateHandle)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      />
    </g>
  );
}
