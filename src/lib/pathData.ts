// Minimal SVG path ("d" attribute) parser/serializer that normalizes every
// command to absolute coordinates and exposes editable anchor/control points.

export type PathCommandType = 'M' | 'L' | 'C' | 'Q' | 'Z';

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathCommand {
  type: PathCommandType;
  // Anchor point (end point of this command). Absent for 'Z'.
  point?: PathPoint;
  // Control points for C (2) and Q (1), in absolute coordinates.
  controls?: PathPoint[];
}

const CMD_RE = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
const NUM_RE = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function parseNums(str: string): number[] {
  const matches = str.match(NUM_RE);
  return matches ? matches.map(Number) : [];
}

export function parsePath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  let cur: PathPoint = { x: 0, y: 0 };
  let start: PathPoint = { x: 0, y: 0 };
  let lastControl: PathPoint | null = null;
  let lastType: string | null = null;

  let match: RegExpExecArray | null;
  CMD_RE.lastIndex = 0;
  while ((match = CMD_RE.exec(d))) {
    const rawType = match[1];
    const isRelative = rawType === rawType.toLowerCase();
    const type = rawType.toUpperCase();
    const nums = parseNums(match[2]);

    const consume = (count: number): number[][] => {
      const groups: number[][] = [];
      for (let i = 0; i + count <= nums.length; i += count) {
        groups.push(nums.slice(i, i + count));
      }
      return groups;
    };

    switch (type) {
      case 'M': {
        const groups = consume(2);
        groups.forEach((g, idx) => {
          const x = isRelative ? cur.x + g[0] : g[0];
          const y = isRelative ? cur.y + g[1] : g[1];
          cur = { x, y };
          if (idx === 0) start = { ...cur };
          commands.push({ type: idx === 0 ? 'M' : 'L', point: { ...cur } });
        });
        lastControl = null;
        break;
      }
      case 'L': {
        consume(2).forEach((g) => {
          const x = isRelative ? cur.x + g[0] : g[0];
          const y = isRelative ? cur.y + g[1] : g[1];
          cur = { x, y };
          commands.push({ type: 'L', point: { ...cur } });
        });
        lastControl = null;
        break;
      }
      case 'H': {
        nums.forEach((n) => {
          const x = isRelative ? cur.x + n : n;
          cur = { x, y: cur.y };
          commands.push({ type: 'L', point: { ...cur } });
        });
        lastControl = null;
        break;
      }
      case 'V': {
        nums.forEach((n) => {
          const y = isRelative ? cur.y + n : n;
          cur = { x: cur.x, y };
          commands.push({ type: 'L', point: { ...cur } });
        });
        lastControl = null;
        break;
      }
      case 'C': {
        consume(6).forEach((g) => {
          const c1 = { x: isRelative ? cur.x + g[0] : g[0], y: isRelative ? cur.y + g[1] : g[1] };
          const c2 = { x: isRelative ? cur.x + g[2] : g[2], y: isRelative ? cur.y + g[3] : g[3] };
          const p = { x: isRelative ? cur.x + g[4] : g[4], y: isRelative ? cur.y + g[5] : g[5] };
          commands.push({ type: 'C', point: p, controls: [c1, c2] });
          lastControl = c2;
          cur = p;
        });
        break;
      }
      case 'S': {
        consume(4).forEach((g) => {
          const c1 = lastControl
            ? { x: 2 * cur.x - lastControl.x, y: 2 * cur.y - lastControl.y }
            : { ...cur };
          const c2 = { x: isRelative ? cur.x + g[0] : g[0], y: isRelative ? cur.y + g[1] : g[1] };
          const p = { x: isRelative ? cur.x + g[2] : g[2], y: isRelative ? cur.y + g[3] : g[3] };
          commands.push({ type: 'C', point: p, controls: [c1, c2] });
          lastControl = c2;
          cur = p;
        });
        break;
      }
      case 'Q': {
        consume(4).forEach((g) => {
          const c1 = { x: isRelative ? cur.x + g[0] : g[0], y: isRelative ? cur.y + g[1] : g[1] };
          const p = { x: isRelative ? cur.x + g[2] : g[2], y: isRelative ? cur.y + g[3] : g[3] };
          commands.push({ type: 'Q', point: p, controls: [c1] });
          lastControl = c1;
          cur = p;
        });
        break;
      }
      case 'T': {
        consume(2).forEach((g) => {
          const c1 = lastControl
            ? { x: 2 * cur.x - lastControl.x, y: 2 * cur.y - lastControl.y }
            : { ...cur };
          const p = { x: isRelative ? cur.x + g[0] : g[0], y: isRelative ? cur.y + g[1] : g[1] };
          commands.push({ type: 'Q', point: p, controls: [c1] });
          lastControl = c1;
          cur = p;
        });
        break;
      }
      case 'A': {
        // Arcs are approximated as a straight line to their endpoint for
        // editing purposes; visually this only matters while dragging.
        consume(7).forEach((g) => {
          const x = isRelative ? cur.x + g[5] : g[5];
          const y = isRelative ? cur.y + g[6] : g[6];
          cur = { x, y };
          commands.push({ type: 'L', point: { ...cur } });
        });
        lastControl = null;
        break;
      }
      case 'Z': {
        commands.push({ type: 'Z' });
        cur = { ...start };
        lastControl = null;
        break;
      }
    }
    lastType = type;
  }
  void lastType;
  return commands;
}

export function serializePath(commands: PathCommand[]): string {
  return commands
    .map((c) => {
      switch (c.type) {
        case 'M':
          return `M${fmt(c.point!.x)},${fmt(c.point!.y)}`;
        case 'L':
          return `L${fmt(c.point!.x)},${fmt(c.point!.y)}`;
        case 'C':
          return `C${fmt(c.controls![0].x)},${fmt(c.controls![0].y)} ${fmt(c.controls![1].x)},${fmt(c.controls![1].y)} ${fmt(c.point!.x)},${fmt(c.point!.y)}`;
        case 'Q':
          return `Q${fmt(c.controls![0].x)},${fmt(c.controls![0].y)} ${fmt(c.point!.x)},${fmt(c.point!.y)}`;
        case 'Z':
          return 'Z';
        default:
          return '';
      }
    })
    .join(' ');
}

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

// Splits a compound path's commands at each "M" into independent subpaths —
// e.g. a wordmark exported as one <path> with one sub-contour per letter.
export function splitSubpaths(commands: PathCommand[]): PathCommand[][] {
  const subpaths: PathCommand[][] = [];
  let current: PathCommand[] = [];
  for (const c of commands) {
    if (c.type === 'M') {
      if (current.length) subpaths.push(current);
      current = [c];
    } else {
      current.push(c);
    }
  }
  if (current.length) subpaths.push(current);
  return subpaths;
}

export function countSubpaths(d: string): number {
  return splitSubpaths(parsePath(d)).length;
}

function lerp(a: PathPoint, b: PathPoint, t: number): PathPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Whether command `index` represents a drawn segment that a node can be
// inserted on (anything with a real geometry from the previous point — i.e.
// not the initial move or a start-of-subpath move).
export function isInsertableSegment(commands: PathCommand[], index: number): boolean {
  if (index <= 0 || index >= commands.length) return false;
  const seg = commands[index];
  const prev = commands[index - 1];
  return !!(seg.point && prev.point && seg.type !== 'M' && seg.type !== 'Z');
}

// Insert an anchor on the segment ending at command `index`, subdividing the
// underlying line/curve at parameter `t` so the visible shape is unchanged.
// Returns the new command list and the index of the freshly inserted anchor.
export function insertNode(
  commands: PathCommand[],
  index: number,
  t = 0.5
): { commands: PathCommand[]; newIndex: number } {
  if (!isInsertableSegment(commands, index)) return { commands, newIndex: index };
  const seg = commands[index];
  const prev = commands[index - 1];
  const P0 = prev.point!;
  const P3 = seg.point!;
  const out = commands.slice();

  if (seg.type === 'L') {
    const mid = lerp(P0, P3, t);
    out.splice(index, 1, { type: 'L', point: mid }, { type: 'L', point: { ...P3 } });
  } else if (seg.type === 'C' && seg.controls) {
    const [P1, P2] = seg.controls;
    const A = lerp(P0, P1, t);
    const B = lerp(P1, P2, t);
    const C = lerp(P2, P3, t);
    const D = lerp(A, B, t);
    const E = lerp(B, C, t);
    const F = lerp(D, E, t);
    out.splice(
      index,
      1,
      { type: 'C', point: F, controls: [A, D] },
      { type: 'C', point: { ...P3 }, controls: [E, C] }
    );
  } else if (seg.type === 'Q' && seg.controls) {
    const [P1] = seg.controls;
    const A = lerp(P0, P1, t);
    const B = lerp(P1, P3, t);
    const M = lerp(A, B, t);
    out.splice(index, 1, { type: 'Q', point: M, controls: [A] }, { type: 'Q', point: { ...P3 }, controls: [B] });
  } else {
    return { commands, newIndex: index };
  }
  return { commands: out, newIndex: index };
}

// Remove the anchor at command `index`. Keeps the path drawable (at least two
// anchors) and, when deleting a subpath's opening move, promotes the next
// anchor to the new "M".
export function deleteNode(commands: PathCommand[], index: number): PathCommand[] {
  const anchors = commands.filter((c) => c.point);
  if (anchors.length <= 2) return commands;
  const target = commands[index];
  if (!target || !target.point) return commands;
  const out = commands.slice();

  if (target.type === 'M') {
    const next = out[index + 1];
    if (next && next.point && next.type !== 'M') {
      out[index + 1] = { type: 'M', point: { ...next.point } };
    }
  }
  out.splice(index, 1);
  return out;
}

// Reset a curve anchor back to a plain corner (drops its bezier handles).
export function resetNode(commands: PathCommand[], index: number): PathCommand[] {
  const target = commands[index];
  if (!target || !target.point || (target.type !== 'C' && target.type !== 'Q')) return commands;
  const out = commands.slice();
  out[index] = { type: 'L', point: { ...target.point } };
  return out;
}

export function nodeIsCurve(commands: PathCommand[], index: number): boolean {
  const c = commands[index];
  return !!c && (c.type === 'C' || c.type === 'Q');
}

export function pathBounds(d: string): { x: number; y: number; width: number; height: number } {
  const commands = parsePath(d);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (p?: PathPoint) => {
    if (!p) return;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  commands.forEach((c) => {
    visit(c.point);
    c.controls?.forEach(visit);
  });
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
