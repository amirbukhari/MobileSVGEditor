import { parsePath, serializePath, type PathCommand } from './pathData';

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

// Simplifies straight-line runs ("L" commands) within a path's "d" while
// leaving M/C/Q/Z commands untouched, so curves keep their shape and only
// over-dense polyline sections lose redundant points.
export function simplifyPathD(d: string, epsilon: number): string {
  const commands = parsePath(d);
  const result: PathCommand[] = [];
  let i = 0;
  while (i < commands.length) {
    const cmd = commands[i];
    if (cmd.type !== 'L') {
      result.push(cmd);
      i++;
      continue;
    }
    const prevPoint = result[result.length - 1]?.point;
    const runPoints: { x: number; y: number }[] = prevPoint ? [prevPoint] : [];
    const runStart = i;
    while (i < commands.length && commands[i].type === 'L') {
      runPoints.push(commands[i].point!);
      i++;
    }
    if (runPoints.length < 3) {
      for (let j = runStart; j < i; j++) result.push(commands[j]);
      continue;
    }
    const asArr: [number, number][] = runPoints.map((p) => [p.x, p.y]);
    const simplified = douglasPeucker(asArr, epsilon);
    const startIdx = prevPoint ? 1 : 0;
    for (let k = startIdx; k < simplified.length; k++) {
      result.push({ type: 'L', point: { x: simplified[k][0], y: simplified[k][1] } });
    }
  }
  return serializePath(result);
}

export function countPathAnchors(d: string): number {
  return parsePath(d).filter((c) => c.point).length;
}
