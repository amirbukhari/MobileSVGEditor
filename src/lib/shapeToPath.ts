import type { Shape } from '../types';
import { parsePath, type PathCommand } from './pathData';

// Circle/ellipse-as-four-cubic-beziers constant (4/3 * (sqrt(2)-1)).
const KAPPA = 0.5522847498;

// Converts any shape type's own local (untransformed) geometry into path
// commands, so shapes of different kinds can be combined into one <path>.
export function shapeToPathCommands(shape: Shape): PathCommand[] {
  switch (shape.type) {
    case 'path':
      return parsePath(shape.d);

    case 'rect': {
      const { x, y, width: w, height: h } = shape;
      const rx = Math.min(Math.max(shape.rx, 0), w / 2);
      const ry = Math.min(Math.max(shape.ry || shape.rx, 0), h / 2);
      if (rx <= 0 || ry <= 0) {
        return [
          { type: 'M', point: { x, y } },
          { type: 'L', point: { x: x + w, y } },
          { type: 'L', point: { x: x + w, y: y + h } },
          { type: 'L', point: { x, y: y + h } },
          { type: 'Z' },
        ];
      }
      const kx = rx * KAPPA;
      const ky = ry * KAPPA;
      return [
        { type: 'M', point: { x: x + rx, y } },
        { type: 'L', point: { x: x + w - rx, y } },
        { type: 'C', controls: [{ x: x + w - rx + kx, y }, { x: x + w, y: y + ry - ky }], point: { x: x + w, y: y + ry } },
        { type: 'L', point: { x: x + w, y: y + h - ry } },
        {
          type: 'C',
          controls: [{ x: x + w, y: y + h - ry + ky }, { x: x + w - rx + kx, y: y + h }],
          point: { x: x + w - rx, y: y + h },
        },
        { type: 'L', point: { x: x + rx, y: y + h } },
        { type: 'C', controls: [{ x: x + rx - kx, y: y + h }, { x, y: y + h - ry + ky }], point: { x, y: y + h - ry } },
        { type: 'L', point: { x, y: y + ry } },
        { type: 'C', controls: [{ x, y: y + ry - ky }, { x: x + rx - kx, y }], point: { x: x + rx, y } },
        { type: 'Z' },
      ];
    }

    case 'circle': {
      const { cx, cy, r } = shape;
      const k = r * KAPPA;
      return [
        { type: 'M', point: { x: cx + r, y: cy } },
        { type: 'C', controls: [{ x: cx + r, y: cy + k }, { x: cx + k, y: cy + r }], point: { x: cx, y: cy + r } },
        { type: 'C', controls: [{ x: cx - k, y: cy + r }, { x: cx - r, y: cy + k }], point: { x: cx - r, y: cy } },
        { type: 'C', controls: [{ x: cx - r, y: cy - k }, { x: cx - k, y: cy - r }], point: { x: cx, y: cy - r } },
        { type: 'C', controls: [{ x: cx + k, y: cy - r }, { x: cx + r, y: cy - k }], point: { x: cx + r, y: cy } },
        { type: 'Z' },
      ];
    }

    case 'ellipse': {
      const { cx, cy, rx, ry } = shape;
      const kx = rx * KAPPA;
      const ky = ry * KAPPA;
      return [
        { type: 'M', point: { x: cx + rx, y: cy } },
        { type: 'C', controls: [{ x: cx + rx, y: cy + ky }, { x: cx + kx, y: cy + ry }], point: { x: cx, y: cy + ry } },
        { type: 'C', controls: [{ x: cx - kx, y: cy + ry }, { x: cx - rx, y: cy + ky }], point: { x: cx - rx, y: cy } },
        { type: 'C', controls: [{ x: cx - rx, y: cy - ky }, { x: cx - kx, y: cy - ry }], point: { x: cx, y: cy - ry } },
        { type: 'C', controls: [{ x: cx + kx, y: cy - ry }, { x: cx + rx, y: cy - ky }], point: { x: cx + rx, y: cy } },
        { type: 'Z' },
      ];
    }

    case 'line':
      return [
        { type: 'M', point: { x: shape.x1, y: shape.y1 } },
        { type: 'L', point: { x: shape.x2, y: shape.y2 } },
      ];

    case 'polygon':
    case 'polyline': {
      const [first, ...rest] = shape.points;
      const commands: PathCommand[] = [
        { type: 'M', point: { x: first[0], y: first[1] } },
        ...rest.map((p): PathCommand => ({ type: 'L', point: { x: p[0], y: p[1] } })),
      ];
      if (shape.type === 'polygon') commands.push({ type: 'Z' });
      return commands;
    }
  }
}
