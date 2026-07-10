import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Shape } from '../types';
import { boundsCenter, localBounds, transformString } from '../lib/geometry';

interface Props {
  shape: Shape;
  selected: boolean;
  dimmed: boolean;
  onPointerDown?: (e: ReactPointerEvent<SVGElement>) => void;
  onPointerMove?: (e: ReactPointerEvent<SVGElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<SVGElement>) => void;
}

export function ShapeRenderer({ shape, selected, dimmed, onPointerDown, onPointerMove, onPointerUp }: Props) {
  if (!shape.visible) return null;
  const center = boundsCenter(localBounds(shape));
  const transform = transformString(shape.transform, center);

  const style: React.CSSProperties = {
    cursor: onPointerDown ? 'pointer' : undefined,
    opacity: dimmed ? 0.35 : 1,
  };

  const common = {
    fill: shape.style.fill,
    fillOpacity: shape.style.fillOpacity,
    stroke: shape.style.stroke,
    strokeWidth: shape.style.strokeWidth,
    strokeOpacity: shape.style.strokeOpacity,
    opacity: shape.style.opacity,
    pointerEvents: 'all' as const,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    style,
    'data-shape-id': shape.id,
  };

  let el: React.ReactNode = null;
  switch (shape.type) {
    case 'path':
      el = <path d={shape.d} {...common} />;
      break;
    case 'rect':
      el = <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} ry={shape.ry} {...common} />;
      break;
    case 'circle':
      el = <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
      break;
    case 'ellipse':
      el = <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />;
      break;
    case 'line':
      el = <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...common} />;
      break;
    case 'polygon':
    case 'polyline': {
      const pts = shape.points.map((p) => `${p[0]},${p[1]}`).join(' ');
      el =
        shape.type === 'polygon' ? (
          <polygon points={pts} {...common} />
        ) : (
          <polyline points={pts} {...common} />
        );
      break;
    }
  }

  return (
    <g transform={transform} className={selected ? 'shape-selected' : undefined}>
      {el}
    </g>
  );
}
