import type { BBox, Shape, ShapeTransform } from '../types';
import { pathBounds } from './pathData';

export function localBounds(shape: Shape): BBox {
  switch (shape.type) {
    case 'path': {
      const b = pathBounds(shape.d);
      return b;
    }
    case 'rect':
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    case 'circle':
      return {
        x: shape.cx - shape.r,
        y: shape.cy - shape.r,
        width: shape.r * 2,
        height: shape.r * 2,
      };
    case 'ellipse':
      return {
        x: shape.cx - shape.rx,
        y: shape.cy - shape.ry,
        width: shape.rx * 2,
        height: shape.ry * 2,
      };
    case 'line': {
      const x = Math.min(shape.x1, shape.x2);
      const y = Math.min(shape.y1, shape.y2);
      return { x, y, width: Math.abs(shape.x2 - shape.x1), height: Math.abs(shape.y2 - shape.y1) };
    }
    case 'polygon':
    case 'polyline': {
      const xs = shape.points.map((p) => p[0]);
      const ys = shape.points.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
    }
  }
}

export function boundsCenter(b: BBox): { x: number; y: number } {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

// Build the SVG transform attribute string for a shape: move by (x,y), then
// rotate/scale around the shape's own local-space center.
export function transformString(t: ShapeTransform, center: { x: number; y: number }): string {
  const parts = [`translate(${round(t.x)} ${round(t.y)})`];
  if (t.rotate !== 0 || t.scaleX !== 1 || t.scaleY !== 1) {
    parts.push(`translate(${round(center.x)} ${round(center.y)})`);
    if (t.rotate !== 0) parts.push(`rotate(${round(t.rotate)})`);
    if (t.scaleX !== 1 || t.scaleY !== 1) parts.push(`scale(${round(t.scaleX)} ${round(t.scaleY)})`);
    parts.push(`translate(${round(-center.x)} ${round(-center.y)})`);
  }
  return parts.join(' ');
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function rotatePoint(
  p: { x: number; y: number },
  center: { x: number; y: number },
  degrees: number
): { x: number; y: number } {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Inverse of transformString: maps a point in the shape's parent (world)
// space back into the shape's local, untransformed coordinate space.
export function worldToLocal(
  world: { x: number; y: number },
  t: ShapeTransform,
  center: { x: number; y: number }
): { x: number; y: number } {
  const centerWorld = { x: t.x + center.x, y: t.y + center.y };
  const rel = { x: world.x - centerWorld.x, y: world.y - centerWorld.y };
  const unrotated = rotatePoint(rel, { x: 0, y: 0 }, -t.rotate);
  const sx = t.scaleX === 0 ? 1e-6 : t.scaleX;
  const sy = t.scaleY === 0 ? 1e-6 : t.scaleY;
  return { x: center.x + unrotated.x / sx, y: center.y + unrotated.y / sy };
}
