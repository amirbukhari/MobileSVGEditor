import type { Shape, SvgDoc } from '../types';
import { localBounds, boundsCenter, transformString } from './geometry';

function styleAttrs(s: Shape['style']): string {
  const parts: string[] = [];
  parts.push(`fill="${s.fill}"`);
  if (s.fillOpacity !== 1) parts.push(`fill-opacity="${s.fillOpacity}"`);
  parts.push(`stroke="${s.stroke}"`);
  if (s.stroke !== 'none') {
    parts.push(`stroke-width="${s.strokeWidth}"`);
    if (s.strokeOpacity !== 1) parts.push(`stroke-opacity="${s.strokeOpacity}"`);
  }
  if (s.opacity !== 1) parts.push(`opacity="${s.opacity}"`);
  return parts.join(' ');
}

function shapeToSvgElement(shape: Shape): string {
  const center = boundsCenter(localBounds(shape));
  const t = transformString(shape.transform, center);
  const hasTransform =
    shape.transform.x !== 0 ||
    shape.transform.y !== 0 ||
    shape.transform.rotate !== 0 ||
    shape.transform.scaleX !== 1 ||
    shape.transform.scaleY !== 1;
  const transformAttr = hasTransform ? ` transform="${t}"` : '';
  const style = styleAttrs(shape.style);
  const visibility = shape.visible ? '' : ' display="none"';

  let geom = '';
  switch (shape.type) {
    case 'path':
      geom = `<path d="${shape.d}" ${style} />`;
      break;
    case 'rect':
      geom = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.rx}" ry="${shape.ry}" ${style} />`;
      break;
    case 'circle':
      geom = `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" ${style} />`;
      break;
    case 'ellipse':
      geom = `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" ${style} />`;
      break;
    case 'line':
      geom = `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" ${style} />`;
      break;
    case 'polygon':
    case 'polyline': {
      const pts = shape.points.map((p) => `${p[0]},${p[1]}`).join(' ');
      geom = `<${shape.type} points="${pts}" ${style} />`;
      break;
    }
  }

  if (transformAttr || visibility) {
    return `<g${transformAttr}${visibility}>${geom}</g>`;
  }
  return geom;
}

export function shapesToSvgString(shapes: Shape[], doc: SvgDoc, opts?: { pretty?: boolean }): string {
  const [vx, vy, vw, vh] = doc.viewBox;
  const body = shapes.map(shapeToSvgElement).join(opts?.pretty ? '\n  ' : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="${vx} ${vy} ${vw} ${vh}">${opts?.pretty ? '\n  ' : ''}${body}${opts?.pretty ? '\n' : ''}</svg>`;
}
