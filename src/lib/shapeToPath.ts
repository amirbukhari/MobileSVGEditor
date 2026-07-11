import type { PathShape, Shape } from '../types';
import { boundsCenter, localBounds, localToWorld } from './geometry';
import { parsePath, serializePath, type PathCommand } from './pathData';


export function shapeToPathData(shape: Shape): string {
  switch (shape.type) {
    case 'path':
      return serializePath(applyTransformToCommands(parsePath(shape.d), shape));
    case 'rect': {
      const { x, y, width: w, height: h, rx, ry } = shape;
      if (!rx && !ry) return transformD(`M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`, shape);
      const rX = Math.min(rx || ry, w / 2);
      const rY = Math.min(ry || rx, h / 2);
      return transformD(
        `M${x + rX},${y} L${x + w - rX},${y} Q${x + w},${y} ${x + w},${y + rY} L${x + w},${y + h - rY} Q${x + w},${y + h} ${x + w - rX},${y + h} L${x + rX},${y + h} Q${x},${y + h} ${x},${y + h - rY} L${x},${y + rY} Q${x},${y} ${x + rX},${y} Z`,
        shape
      );
    }
    case 'circle':
      return ellipsePath(shape.cx, shape.cy, shape.r, shape.r, shape);
    case 'ellipse':
      return ellipsePath(shape.cx, shape.cy, shape.rx, shape.ry, shape);
    case 'line':
      return transformD(`M${shape.x1},${shape.y1} L${shape.x2},${shape.y2}`, shape);
    case 'polygon':
    case 'polyline': {
      const first = shape.points[0];
      if (!first) return '';
      const rest = shape.points.slice(1).map(([x, y]) => `L${x},${y}`).join(' ');
      return transformD(`M${first[0]},${first[1]} ${rest}${shape.type === 'polygon' ? ' Z' : ''}`, shape);
    }
  }
}

export function makePathShapeFrom(shape: Shape, name = shape.name): PathShape {
  return { ...shape, type: 'path', name, d: shapeToPathData(shape), transform: { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 } };
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number, shape: Shape): string {
  const k = 0.5522847498;
  return transformD(
    `M${cx + rx},${cy} C${cx + rx},${cy + ry * k} ${cx + rx * k},${cy + ry} ${cx},${cy + ry} C${cx - rx * k},${cy + ry} ${cx - rx},${cy + ry * k} ${cx - rx},${cy} C${cx - rx},${cy - ry * k} ${cx - rx * k},${cy - ry} ${cx},${cy - ry} C${cx + rx * k},${cy - ry} ${cx + rx},${cy - ry * k} ${cx + rx},${cy} Z`,
    shape
  );
}

function transformD(d: string, shape: Shape): string {
  return serializePath(applyTransformToCommands(parsePath(d), shape));
}

function applyTransformToCommands(commands: PathCommand[], shape: Shape): PathCommand[] {
  const center = boundsCenter(localBounds(shape));
  return commands.map((c) => ({
    ...c,
    point: c.point ? localToWorld(c.point, shape.transform, center) : undefined,
    controls: c.controls?.map((p) => localToWorld(p, shape.transform, center)),
  }));
}
