import type { PolyShape, Shape, ShapeStyle, SvgDoc } from '../types';
import { defaultStyle, defaultTransform } from '../types';
import { parsePath, serializePath } from './pathData';

interface Offset {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
}

const IDENTITY_OFFSET: Offset = { tx: 0, ty: 0, sx: 1, sy: 1 };

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `shape_${Date.now().toString(36)}_${idCounter}`;
}

function num(v: string | null, fallback = 0): number {
  if (v === null || v === '') return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function readStyle(el: Element, inherited: ShapeStyle): ShapeStyle {
  const style: ShapeStyle = { ...inherited };
  const styleAttr = el.getAttribute('style');
  const inline: Record<string, string> = {};
  if (styleAttr) {
    styleAttr.split(';').forEach((decl) => {
      const [k, v] = decl.split(':');
      if (k && v) inline[k.trim()] = v.trim();
    });
  }
  const get = (name: string) => inline[name] ?? el.getAttribute(name);

  const fill = get('fill');
  if (fill) style.fill = fill;
  const fillOpacity = get('fill-opacity');
  if (fillOpacity) style.fillOpacity = num(fillOpacity, 1);
  const stroke = get('stroke');
  if (stroke) style.stroke = stroke;
  const strokeWidth = get('stroke-width');
  if (strokeWidth) style.strokeWidth = num(strokeWidth, 1);
  const strokeOpacity = get('stroke-opacity');
  if (strokeOpacity) style.strokeOpacity = num(strokeOpacity, 1);
  const opacity = get('opacity');
  if (opacity) style.opacity = num(opacity, 1);
  return style;
}

// Parses a transform attribute into a translate+scale approximation, good
// enough for the translate/scale/matrix combos typical logo exports use to
// fit artwork into a viewBox. Rotation/skew on a <g> is rare for flat logo
// exports and is intentionally not composed into child geometry for MVP.
function parseGroupTransform(attr: string | null): Offset {
  if (!attr) return { ...IDENTITY_OFFSET };
  let offset: Offset = { ...IDENTITY_OFFSET };
  const fnRe = /(translate|scale|matrix)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(attr))) {
    const nums = m[2].trim().split(/[\s,]+/).map(Number);
    if (m[1] === 'translate') {
      offset = composeOffset(offset, { tx: nums[0] || 0, ty: nums[1] ?? 0, sx: 1, sy: 1 });
    } else if (m[1] === 'scale') {
      const sx = nums[0] ?? 1;
      const sy = nums[1] ?? sx;
      offset = composeOffset(offset, { tx: 0, ty: 0, sx, sy });
    } else if (m[1] === 'matrix' && nums.length === 6) {
      const [a, b, c, d, e, f] = nums;
      if (b === 0 && c === 0) {
        offset = composeOffset(offset, { tx: e, ty: f, sx: a, sy: d });
      }
    }
  }
  return offset;
}

function composeOffset(outer: Offset, inner: Offset): Offset {
  return {
    tx: outer.tx + outer.sx * inner.tx,
    ty: outer.ty + outer.sy * inner.ty,
    sx: outer.sx * inner.sx,
    sy: outer.sy * inner.sy,
  };
}

function applyOffsetXY(x: number, y: number, offset: Offset): [number, number] {
  return [x * offset.sx + offset.tx, y * offset.sy + offset.ty];
}

function makeBase(el: Element, inheritedStyle: ShapeStyle, name: string) {
  return {
    id: genId(),
    name,
    visible: true,
    locked: false,
    style: readStyle(el, inheritedStyle),
    transform: defaultTransform(),
  };
}

function walk(el: Element, inheritedStyle: ShapeStyle, offset: Offset, out: Shape[], counter: { n: number }) {
  const tag = el.tagName.toLowerCase();
  const style = readStyle(el, inheritedStyle);

  if (tag === 'g' || tag === 'svg') {
    const t = parseGroupTransform(el.getAttribute('transform'));
    const childOffset = composeOffset(offset, t);
    Array.from(el.children).forEach((child) => walk(child, style, childOffset, out, counter));
    return;
  }

  switch (tag) {
    case 'path': {
      const d = el.getAttribute('d');
      if (!d) return;
      counter.n += 1;
      out.push({
        ...makeBase(el, inheritedStyle, `Path ${counter.n}`),
        type: 'path',
        d: offsetPathData(d, offset),
      });
      return;
    }
    case 'rect': {
      counter.n += 1;
      const [x, y] = applyOffsetXY(num(el.getAttribute('x')), num(el.getAttribute('y')), offset);
      out.push({
        ...makeBase(el, inheritedStyle, `Rectangle ${counter.n}`),
        type: 'rect',
        x,
        y,
        width: num(el.getAttribute('width')) * offset.sx,
        height: num(el.getAttribute('height')) * offset.sy,
        rx: num(el.getAttribute('rx')) * offset.sx,
        ry: num(el.getAttribute('ry') ?? el.getAttribute('rx')) * offset.sy,
      });
      return;
    }
    case 'circle': {
      counter.n += 1;
      const [cx, cy] = applyOffsetXY(num(el.getAttribute('cx')), num(el.getAttribute('cy')), offset);
      out.push({
        ...makeBase(el, inheritedStyle, `Circle ${counter.n}`),
        type: 'circle',
        cx,
        cy,
        r: num(el.getAttribute('r')) * Math.max(Math.abs(offset.sx), Math.abs(offset.sy)),
      });
      return;
    }
    case 'ellipse': {
      counter.n += 1;
      const [cx, cy] = applyOffsetXY(num(el.getAttribute('cx')), num(el.getAttribute('cy')), offset);
      out.push({
        ...makeBase(el, inheritedStyle, `Ellipse ${counter.n}`),
        type: 'ellipse',
        cx,
        cy,
        rx: num(el.getAttribute('rx')) * offset.sx,
        ry: num(el.getAttribute('ry')) * offset.sy,
      });
      return;
    }
    case 'line': {
      counter.n += 1;
      const [x1, y1] = applyOffsetXY(num(el.getAttribute('x1')), num(el.getAttribute('y1')), offset);
      const [x2, y2] = applyOffsetXY(num(el.getAttribute('x2')), num(el.getAttribute('y2')), offset);
      out.push({
        ...makeBase(el, inheritedStyle, `Line ${counter.n}`),
        type: 'line',
        x1,
        y1,
        x2,
        y2,
      });
      return;
    }
    case 'polygon':
    case 'polyline': {
      const pointsAttr = el.getAttribute('points') || '';
      const nums = pointsAttr.trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      const points: [number, number][] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        points.push(applyOffsetXY(nums[i], nums[i + 1], offset));
      }
      counter.n += 1;
      out.push({
        ...makeBase(el, inheritedStyle, `${tag === 'polygon' ? 'Polygon' : 'Polyline'} ${counter.n}`),
        type: tag as PolyShape['type'],
        points,
      });
      return;
    }
    default:
      // Unsupported element (text, image, filters, defs, etc.) — skip but
      // still recurse in case it wraps supported children.
      Array.from(el.children).forEach((child) => walk(child, style, offset, out, counter));
  }
}

function offsetPathData(d: string, offset: Offset): string {
  if (offset.tx === 0 && offset.ty === 0 && offset.sx === 1 && offset.sy === 1) return d;
  const commands = parsePath(d);
  const apply = (p: { x: number; y: number }) => {
    const [x, y] = applyOffsetXY(p.x, p.y, offset);
    p.x = x;
    p.y = y;
  };
  commands.forEach((c) => {
    if (c.point) apply(c.point);
    c.controls?.forEach(apply);
  });
  return serializePath(commands);
}

export function parseSvgString(svgText: string): { shapes: Shape[]; doc: SvgDoc } {
  const parser = new DOMParser();
  const xml = parser.parseFromString(svgText, 'image/svg+xml');
  const errorNode = xml.querySelector('parsererror');
  if (errorNode) {
    throw new Error('That file does not look like valid SVG.');
  }
  const svgEl = xml.querySelector('svg');
  if (!svgEl) {
    throw new Error('No <svg> root element found.');
  }

  let viewBox: [number, number, number, number];
  const vbAttr = svgEl.getAttribute('viewBox');
  const widthAttr = num(svgEl.getAttribute('width'), NaN);
  const heightAttr = num(svgEl.getAttribute('height'), NaN);
  if (vbAttr) {
    const parts = vbAttr.trim().split(/[\s,]+/).map(Number);
    viewBox = [parts[0] || 0, parts[1] || 0, parts[2] || 100, parts[3] || 100];
  } else if (!isNaN(widthAttr) && !isNaN(heightAttr)) {
    viewBox = [0, 0, widthAttr, heightAttr];
  } else {
    viewBox = [0, 0, 512, 512];
  }

  const width = !isNaN(widthAttr) ? widthAttr : viewBox[2];
  const height = !isNaN(heightAttr) ? heightAttr : viewBox[3];

  const shapes: Shape[] = [];
  const inherited = defaultStyle();
  const counter = { n: 0 };
  Array.from(svgEl.children).forEach((child) => walk(child, inherited, { ...IDENTITY_OFFSET }, shapes, counter));

  return { shapes, doc: { width, height, viewBox } };
}

export function starterShapes(): { shapes: Shape[]; doc: SvgDoc } {
  const doc: SvgDoc = { width: 200, height: 200, viewBox: [0, 0, 200, 200] };
  const shapes: Shape[] = [
    {
      id: genId(),
      type: 'circle',
      name: 'Circle 1',
      visible: true,
      locked: false,
      style: { ...defaultStyle(), fill: '#5b8def' },
      transform: defaultTransform(),
      cx: 100,
      cy: 85,
      r: 55,
    },
    {
      id: genId(),
      type: 'rect',
      name: 'Rectangle 1',
      visible: true,
      locked: false,
      style: { ...defaultStyle(), fill: '#1f2a44' },
      transform: defaultTransform(),
      x: 55,
      y: 140,
      width: 90,
      height: 30,
      rx: 8,
      ry: 8,
    },
  ];
  return { shapes, doc };
}
