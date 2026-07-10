import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ShapeRenderer } from './ShapeRenderer';
import { TransformHandles } from './TransformHandles';
import { NodeEditor } from './NodeEditor';
import { clientToSvgPoint } from '../lib/svgPoint';

export interface CanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

const MOVE_THRESHOLD = 3;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 12;

export const Canvas = forwardRef<CanvasHandle>(function Canvas(_props, ref) {
  const doc = useEditorStore((s) => s.doc);
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const nodeEditId = useEditorStore((s) => s.nodeEditId);
  const step = useEditorStore((s) => s.step);
  const select = useEditorStore((s) => s.select);
  const updateTransform = useEditorStore((s) => s.updateTransform);
  const commitTransform = useEditorStore((s) => s.commitTransform);

  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const backgroundHitRef = useRef(false);
  const pinchRef = useRef<{ initialDist: number; initialZoom: number; initialPan: { x: number; y: number }; mid: { x: number; y: number } } | null>(null);
  const panRef = useRef<{ startClient: { x: number; y: number }; startPan: { x: number; y: number } } | null>(null);
  const bodyDragRef = useRef<{
    id: string;
    startPointerRoot: { x: number; y: number };
    startTransform: { x: number; y: number };
    moved: boolean;
    startClient: { x: number; y: number };
  } | null>(null);

  const fit = () => {
    const el = viewportRef.current;
    if (!el) return;
    const pad = 32;
    const availW = el.clientWidth - pad * 2;
    const availH = el.clientHeight - pad * 2;
    const z = Math.min(availW / doc.width, availH / doc.height, MAX_ZOOM);
    const clamped = Math.max(z, MIN_ZOOM);
    setZoom(clamped);
    setPan({
      x: (el.clientWidth - doc.width * clamped) / 2,
      y: (el.clientHeight - doc.height * clamped) / 2,
    });
  };

  useEffect(() => {
    fit();
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.width, doc.height]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(0.8),
    fit,
  }));

  function zoomBy(factor: number) {
    const el = viewportRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setZoom((z) => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
      setPan((p) => ({
        x: cx - ((cx - p.x) / z) * nz,
        y: cy - ((cy - p.y) / z) * nz,
      }));
      return nz;
    });
  }

  const onViewportPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const isBackground = (e.target as HTMLElement).classList?.contains('canvas-background-catcher') || e.target === e.currentTarget;
    if (activePointers.current.size === 1) {
      backgroundHitRef.current = isBackground;
    }
    if (activePointers.current.size === 2) {
      bodyDragRef.current = null;
      panRef.current = null;
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = {
        initialDist: dist,
        initialZoom: zoom,
        initialPan: pan,
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      };
    } else if (activePointers.current.size === 1 && isBackground) {
      panRef.current = { startClient: { x: e.clientX, y: e.clientY }, startPan: pan };
    }
  };

  const onViewportPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinchRef.current) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const factor = dist / (pinchRef.current.initialDist || 1);
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.initialZoom * factor));
      const mid = pinchRef.current.mid;
      const el = viewportRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const localX = mid.x - rect.left;
        const localY = mid.y - rect.top;
        const ratio = nz / pinchRef.current.initialZoom;
        setZoom(nz);
        setPan({
          x: localX - (localX - pinchRef.current.initialPan.x) * ratio,
          y: localY - (localY - pinchRef.current.initialPan.y) * ratio,
        });
      }
      return;
    }

    if (panRef.current) {
      const dx = e.clientX - panRef.current.startClient.x;
      const dy = e.clientY - panRef.current.startClient.y;
      setPan({ x: panRef.current.startPan.x + dx, y: panRef.current.startPan.y + dy });
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchRef.current = null;
    if (activePointers.current.size === 0) panRef.current = null;
  };

  const onShapePointerDown = (id: string) => (e: ReactPointerEvent<SVGElement>) => {
    if (step !== 'shape') {
      select(id);
      return;
    }
    select(id);
    const svg = svgRef.current;
    if (!svg) return;
    const shape = shapes.find((s) => s.id === id);
    if (!shape || shape.locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pointerRoot = clientToSvgPoint(svg, e.clientX, e.clientY);
    bodyDragRef.current = {
      id,
      startPointerRoot: pointerRoot,
      startTransform: { x: shape.transform.x, y: shape.transform.y },
      moved: false,
      startClient: { x: e.clientX, y: e.clientY },
    };
  };

  const onShapePointerMove = (e: ReactPointerEvent<SVGElement>) => {
    const drag = bodyDragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    if (activePointers.current.size >= 2) return;
    const dist = Math.hypot(e.clientX - drag.startClient.x, e.clientY - drag.startClient.y);
    if (!drag.moved && dist < MOVE_THRESHOLD) return;
    drag.moved = true;
    const pointerRoot = clientToSvgPoint(svg, e.clientX, e.clientY);
    const dx = pointerRoot.x - drag.startPointerRoot.x;
    const dy = pointerRoot.y - drag.startPointerRoot.y;
    updateTransform(drag.id, { x: drag.startTransform.x + dx, y: drag.startTransform.y + dy }, false);
  };

  const onShapePointerUp = (e: ReactPointerEvent<SVGElement>) => {
    const drag = bodyDragRef.current;
    if (drag?.moved) commitTransform();
    bodyDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onBackgroundTap = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!backgroundHitRef.current) return;
    if (panRef.current) {
      const moved = Math.hypot(e.clientX - panRef.current.startClient.x, e.clientY - panRef.current.startClient.y);
      if (moved > MOVE_THRESHOLD) return;
    }
    select(null);
  };

  const selectedShape = shapes.find((s) => s.id === selectedId);
  const nodeEditShape = shapes.find((s) => s.id === nodeEditId);

  return (
    <div
      ref={viewportRef}
      className="canvas-viewport"
      onPointerDown={onViewportPointerDown}
      onPointerMove={onViewportPointerMove}
      onPointerUp={(e) => {
        endPointer(e);
        onBackgroundTap(e);
      }}
      onPointerCancel={endPointer}
    >
      <div
        className="canvas-stage"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: doc.width, height: doc.height }}
      >
        <svg
          ref={svgRef}
          width={doc.width}
          height={doc.height}
          viewBox={`${doc.viewBox[0]} ${doc.viewBox[1]} ${doc.viewBox[2]} ${doc.viewBox[3]}`}
          className="canvas-svg"
        >
          <rect
            x={doc.viewBox[0] - 10000}
            y={doc.viewBox[1] - 10000}
            width={doc.viewBox[2] + 20000}
            height={doc.viewBox[3] + 20000}
            fill="transparent"
            className="canvas-background-catcher"
          />
          {shapes.map((shape) => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              selected={shape.id === selectedId}
              dimmed={step === 'shape' && nodeEditId !== null && shape.id !== nodeEditId}
              onPointerDown={onShapePointerDown(shape.id)}
              onPointerMove={onShapePointerMove}
              onPointerUp={onShapePointerUp}
            />
          ))}
          {step === 'shape' &&
            selectedShape &&
            !selectedShape.locked &&
            (nodeEditShape ? null : (
              <TransformHandles shape={selectedShape} svgRef={svgRef} docSize={{ width: doc.width, height: doc.height }} />
            ))}
          {step === 'shape' && nodeEditShape && (nodeEditShape.type === 'path' || nodeEditShape.type === 'polygon' || nodeEditShape.type === 'polyline') && (
            <NodeEditor shape={nodeEditShape} svgRef={svgRef} docSize={{ width: doc.width, height: doc.height }} />
          )}
        </svg>
      </div>
      {shapes.length === 0 && (
        <div className="canvas-empty">
          <p>No shapes yet</p>
        </div>
      )}
    </div>
  );
});
