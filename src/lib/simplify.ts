import { parsePath, serializePath, type PathCommand, type PathPoint } from './pathData';

// Ramer-Douglas-Peucker: recursively drops points that lie within `epsilon`
// of the line between their neighbors, preserving the overall silhouette.
export function douglasPeucker(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length < 3) return points.slice();
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], [x1, y1], [x2, y2]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function perpendicularDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(x - x1, y - y1);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
}

export function simplifyPoints(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length <= 2) return points.slice();
  return douglasPeucker(points, epsilon);
}

const CURVE_SAMPLES = 14;

function sampleCubic(p0: PathPoint, c1: PathPoint, c2: PathPoint, p1: PathPoint): [number, number][] {
  const pts: [number, number][] = [];
  for (let s = 1; s <= CURVE_SAMPLES; s++) {
    const t = s / CURVE_SAMPLES;
    const mt = 1 - t;
    const x = mt * mt * mt * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p1.x;
    const y = mt * mt * mt * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p1.y;
    pts.push([x, y]);
  }
  return pts;
}

function sampleQuad(p0: PathPoint, c1: PathPoint, p1: PathPoint): [number, number][] {
  const pts: [number, number][] = [];
  for (let s = 1; s <= CURVE_SAMPLES; s++) {
    const t = s / CURVE_SAMPLES;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * c1.x + t * t * p1.x;
    const y = mt * mt * p0.y + 2 * mt * t * c1.y + t * t * p1.y;
    pts.push([x, y]);
  }
  return pts;
}

// Fits a smooth Catmull-Rom spline (converted to cubic Beziers) through a
// simplified point sequence, so curve-heavy runs stay visually smooth after
// losing anchor points instead of turning faceted.
function catmullRomToBezier(points: [number, number][], closed: boolean): PathCommand[] {
  const n = points.length;
  if (n < 2) return [];
  const get = (i: number): [number, number] => {
    if (closed) return points[((i % n) + n) % n];
    return points[Math.max(0, Math.min(n - 1, i))];
  };
  const commands: PathCommand[] = [];
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    commands.push({
      type: 'C',
      point: { x: p2[0], y: p2[1] },
      controls: [
        { x: c1x, y: c1y },
        { x: c2x, y: c2y },
      ],
    });
  }
  return commands;
}

// Simplifies a path's "d". Runs of pure straight-line ("L") commands are
// reduced directly and stay straight (sharp corners preserved exactly).
// Runs involving curves ("C"/"Q") are flattened to a dense point cloud,
// reduced with Douglas-Peucker, then re-fit as a smooth curve so a
// curve-heavy path (the common case for traced/exported logos) actually
// loses points instead of being left untouched.
export function simplifyPathD(d: string, epsilon: number): string {
  const commands = parsePath(d);
  const result: PathCommand[] = [];
  let i = 0;
  while (i < commands.length) {
    const cmd = commands[i];
    if (cmd.type === 'M' || cmd.type === 'Z') {
      result.push(cmd);
      i++;
      continue;
    }
    const prevPoint = result[result.length - 1]?.point;
    if (!prevPoint) {
      // Malformed path (segment with no preceding anchor) — pass through.
      result.push(cmd);
      i++;
      continue;
    }
    const runStart = i;
    const run: PathCommand[] = [];
    while (i < commands.length && (commands[i].type === 'L' || commands[i].type === 'C' || commands[i].type === 'Q')) {
      run.push(commands[i]);
      i++;
    }
    if (run.length < 2) {
      for (let j = runStart; j < i; j++) result.push(commands[j]);
      continue;
    }

    const allLines = run.every((c) => c.type === 'L');
    if (allLines) {
      const pts: [number, number][] = [
        [prevPoint.x, prevPoint.y],
        ...run.map((c): [number, number] => [c.point!.x, c.point!.y]),
      ];
      const simplified = douglasPeucker(pts, epsilon);
      for (let k = 1; k < simplified.length; k++) {
        result.push({ type: 'L', point: { x: simplified[k][0], y: simplified[k][1] } });
      }
      continue;
    }

    let cursor: PathPoint = prevPoint;
    const dense: [number, number][] = [[cursor.x, cursor.y]];
    for (const c of run) {
      if (c.type === 'L') {
        dense.push([c.point!.x, c.point!.y]);
      } else if (c.type === 'C') {
        dense.push(...sampleCubic(cursor, c.controls![0], c.controls![1], c.point!));
      } else if (c.type === 'Q') {
        dense.push(...sampleQuad(cursor, c.controls![0], c.point!));
      }
      cursor = c.point!;
    }
    const simplifiedDense = douglasPeucker(dense, epsilon);
    result.push(...catmullRomToBezier(simplifiedDense, false));
  }
  return serializePath(result);
}

export function countPathAnchors(d: string): number {
  return parsePath(d).filter((c) => c.point).length;
}
