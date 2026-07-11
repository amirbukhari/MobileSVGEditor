import { create } from 'zustand';
import type { EditorStep, PathShape, PolyShape, Shape, ShapeStyle, ShapeTransform, ShapeType, SvgDoc } from '../types';
import { defaultStyle, defaultTransform } from '../types';
import { parseSvgString, starterShapes } from '../lib/svgImport';
import {
  deleteNode as deletePathNode,
  insertNode as insertPathNode,
  parsePath,
  resetNode as resetPathNode,
  serializePath,
  splitSubpaths,
} from '../lib/pathData';
import { boundsCenter, localBounds } from '../lib/geometry';
import { makePathShapeFrom, shapeToPathData } from '../lib/shapeToPath';

export type AddableShape = 'rect' | 'ellipse' | 'line' | 'triangle' | 'cursiveS' | 'cursiveLoop' | 'cursiveTail';
export type AlignMode = 'center-h' | 'center-v' | 'left' | 'right' | 'top' | 'bottom';

interface HistoryEntry {
  shapes: Shape[];
}

interface EditorState {
  hasDocument: boolean;
  doc: SvgDoc;
  shapes: Shape[];
  selectedId: string | null;
  step: EditorStep;
  nodeEditId: string | null;
  selectedNodeIndex: number | null;
  layersOpen: boolean;
  simplifyOpen: boolean;

  past: HistoryEntry[];
  future: HistoryEntry[];

  // File loading
  loadFromSvgString: (svgText: string) => void;
  loadStarter: () => void;
  loadBlank: () => void;
  reset: () => void;

  // Selection / navigation
  select: (id: string | null) => void;
  setStep: (step: EditorStep) => void;
  toggleNodeEdit: (id: string | null) => void;
  selectNode: (index: number | null) => void;
  setLayersOpen: (open: boolean) => void;
  setSimplifyOpen: (open: boolean) => void;

  // Creation & arrangement
  addShape: (type: AddableShape) => void;
  mergeShapeIntoSelected: (type: AddableShape) => void;
  mergeSelectedShapes: () => void;
  resetTransform: (id: string) => void;
  alignShape: (id: string, mode: AlignMode) => void;

  // Node editing
  addNode: (id: string, segIndex: number, t?: number) => void;
  addNodeAfter: (id: string, index: number) => void;
  removeNode: (id: string, index: number) => void;
  resetNode: (id: string, index: number) => void;

  // Editing
  updateTransform: (id: string, patch: Partial<ShapeTransform>, commit?: boolean) => void;
  commitTransform: () => void;
  updateStyle: (id: string, patch: Partial<ShapeStyle>) => void;
  updateShapeGeometry: (id: string, patch: Partial<Shape>) => void;
  updateGeometryLive: (id: string, patch: Partial<Shape>) => void;
  commitPending: () => void;
  discardPending: () => void;
  renameShape: (id: string, name: string) => void;
  toggleVisible: (id: string) => void;
  toggleLocked: (id: string) => void;
  duplicateShape: (id: string) => void;
  deleteShape: (id: string) => void;
  reorderShape: (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => void;
  flipShape: (id: string, axis: 'h' | 'v') => void;
  breakApartShape: (id: string) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

function cloneShapes(shapes: Shape[]): Shape[] {
  return shapes.map((s) => ({ ...s, style: { ...s.style }, transform: { ...s.transform } }));
}

function newId(): string {
  return `shape_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000000)}`;
}


function cursiveShape(type: AddableShape, cx: number, cy: number, size: number, shapes: Shape[]): PathShape | null {
  const w = size;
  const h = size * 0.55;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const base = {
    id: newId(),
    type: 'path' as const,
    visible: true,
    locked: false,
    style: { ...defaultStyle(), fill: 'none', stroke: '#4f7cff', strokeWidth: Math.max(size * 0.07, 4), strokeOpacity: 1, fillOpacity: 1, opacity: 1 },
    transform: defaultTransform(),
  };
  if (type === 'cursiveS') {
    return { ...base, name: `Cursive S ${shapes.filter((s) => s.name.startsWith('Cursive S')).length + 1}`, d: `M${x + w * 0.78},${y + h * 0.12} C${x + w * 0.18},${y - h * 0.08} ${x + w * 0.1},${y + h * 0.45} ${x + w * 0.52},${y + h * 0.48} C${x + w * 1.02},${y + h * 0.52} ${x + w * 0.86},${y + h * 1.15} ${x + w * 0.2},${y + h * 0.88}` };
  }
  if (type === 'cursiveLoop') {
    return { ...base, name: `Cursive Loop ${shapes.filter((s) => s.name.startsWith('Cursive Loop')).length + 1}`, d: `M${x + w * 0.05},${cy} C${x + w * 0.28},${y + h * 0.08} ${x + w * 0.56},${y + h * 0.1} ${x + w * 0.5},${cy} C${x + w * 0.42},${y + h * 1.05} ${x + w * 0.76},${y + h * 1.03} ${x + w * 0.95},${cy}` };
  }
  if (type === 'cursiveTail') {
    return { ...base, name: `Cursive Tail ${shapes.filter((s) => s.name.startsWith('Cursive Tail')).length + 1}`, d: `M${x},${cy} C${x + w * 0.2},${y + h * 0.15} ${x + w * 0.38},${y + h * 0.82} ${x + w * 0.58},${cy} C${x + w * 0.72},${y + h * 0.22} ${x + w * 0.85},${y + h * 0.32} ${x + w},${y + h * 0.38}` };
  }
  return null;
}

function nextShapeName(shapes: Shape[], type: ShapeType): string {
  const label =
    type === 'rect' ? 'Rectangle' : type === 'ellipse' ? 'Ellipse' : type === 'line' ? 'Line' : type === 'polygon' ? 'Polygon' : 'Shape';
  const n = shapes.filter((s) => s.name.startsWith(label)).length + 1;
  return `${label} ${n}`;
}

let pendingSnapshot: Shape[] | null = null;

export const useEditorStore = create<EditorState>((set, get) => ({
  hasDocument: false,
  doc: { width: 200, height: 200, viewBox: [0, 0, 200, 200] },
  shapes: [],
  selectedId: null,
  step: 'shape',
  nodeEditId: null,
  selectedNodeIndex: null,
  layersOpen: false,
  simplifyOpen: false,
  past: [],
  future: [],

  loadFromSvgString: (svgText: string) => {
    const { shapes, doc } = parseSvgString(svgText);
    set({
      hasDocument: true,
      doc,
      shapes,
      selectedId: null,
      step: 'shape',
      nodeEditId: null,
      selectedNodeIndex: null,
      past: [],
      future: [],
    });
  },

  loadStarter: () => {
    const { shapes, doc } = starterShapes();
    set({
      hasDocument: true,
      doc,
      shapes,
      selectedId: null,
      step: 'shape',
      nodeEditId: null,
      selectedNodeIndex: null,
      past: [],
      future: [],
    });
  },

  loadBlank: () => {
    set({
      hasDocument: true,
      doc: { width: 400, height: 400, viewBox: [0, 0, 400, 400] },
      shapes: [],
      selectedId: null,
      step: 'shape',
      nodeEditId: null,
      selectedNodeIndex: null,
      past: [],
      future: [],
    });
  },

  reset: () => {
    set({
      hasDocument: false,
      shapes: [],
      selectedId: null,
      step: 'shape',
      nodeEditId: null,
      selectedNodeIndex: null,
      past: [],
      future: [],
    });
  },

  select: (id) => set({ selectedId: id, nodeEditId: null, selectedNodeIndex: null }),
  setStep: (step) => set({ step, nodeEditId: null, selectedNodeIndex: null }),
  toggleNodeEdit: (id) => set({ nodeEditId: id, selectedNodeIndex: null }),
  selectNode: (index) => set({ selectedNodeIndex: index }),
  setLayersOpen: (open) => set({ layersOpen: open }),
  setSimplifyOpen: (open) => set({ simplifyOpen: open }),

  updateTransform: (id, patch, commit = false) => {
    if (pendingSnapshot === null) {
      pendingSnapshot = cloneShapes(get().shapes);
    }
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, transform: { ...s.transform, ...patch } } : s)),
    }));
    if (commit) get().commitTransform();
  },

  commitTransform: () => get().commitPending(),

  updateGeometryLive: (id, patch) => {
    if (pendingSnapshot === null) {
      pendingSnapshot = cloneShapes(get().shapes);
    }
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as Shape) : s)),
    }));
  },

  commitPending: () => {
    if (pendingSnapshot) {
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;
      set((state) => ({
        past: [...state.past, { shapes: snapshot }],
        future: [],
      }));
    }
  },

  discardPending: () => {
    if (pendingSnapshot) {
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;
      set({ shapes: snapshot });
    }
  },

  updateStyle: (id, patch) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, style: { ...s.style, ...patch } } : s)),
    }));
  },

  updateShapeGeometry: (id, patch) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as Shape) : s)),
    }));
  },

  renameShape: (id, name) => {
    set((state) => ({ shapes: state.shapes.map((s) => (s.id === id ? { ...s, name } : s)) }));
  },

  toggleVisible: (id) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)),
    }));
  },

  toggleLocked: (id) => {
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)),
    }));
  },

  duplicateShape: (id) => {
    get().pushHistory();
    set((state) => {
      const idx = state.shapes.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const original = state.shapes[idx];
      const copy: Shape = {
        ...original,
        id: `shape_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
        name: `${original.name} copy`,
        style: { ...original.style },
        transform: { ...original.transform, x: original.transform.x + 10, y: original.transform.y + 10 },
      };
      const shapes = [...state.shapes];
      shapes.splice(idx + 1, 0, copy);
      return { shapes, selectedId: copy.id };
    });
  },

  deleteShape: (id) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      nodeEditId: state.nodeEditId === id ? null : state.nodeEditId,
    }));
  },

  reorderShape: (id, dir) => {
    get().pushHistory();
    set((state) => {
      const shapes = [...state.shapes];
      const idx = shapes.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const [item] = shapes.splice(idx, 1);
      if (dir === 'front') shapes.push(item);
      else if (dir === 'back') shapes.unshift(item);
      else if (dir === 'forward') shapes.splice(Math.min(idx + 1, shapes.length), 0, item);
      else shapes.splice(Math.max(idx - 1, 0), 0, item);
      return { shapes };
    });
  },

  flipShape: (id, axis) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) =>
        s.id === id
          ? {
              ...s,
              transform: {
                ...s.transform,
                scaleX: axis === 'h' ? s.transform.scaleX * -1 : s.transform.scaleX,
                scaleY: axis === 'v' ? s.transform.scaleY * -1 : s.transform.scaleY,
              },
            }
          : s
      ),
    }));
  },

  breakApartShape: (id) => {
    const shape = get().shapes.find((s) => s.id === id);
    if (!shape || shape.type !== 'path') return;
    const subpaths = splitSubpaths(parsePath(shape.d));
    if (subpaths.length < 2) return;

    get().pushHistory();
    set((state) => {
      const idx = state.shapes.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const pieces: PathShape[] = subpaths.map((sp, i) => ({
        ...shape,
        id: `shape_${Date.now().toString(36)}_${Math.floor(Math.random() * 100000)}_${i}`,
        name: `${shape.name} ${i + 1}`,
        d: serializePath(sp),
        style: { ...shape.style },
        transform: { ...shape.transform },
      }));
      const shapes = [...state.shapes];
      shapes.splice(idx, 1, ...pieces);
      return { shapes, selectedId: pieces[0].id };
    });
  },

  addShape: (type) => {
    get().pushHistory();
    set((state) => {
      const { doc } = state;
      const cx = doc.viewBox[0] + doc.viewBox[2] / 2;
      const cy = doc.viewBox[1] + doc.viewBox[3] / 2;
      const size = Math.min(doc.viewBox[2], doc.viewBox[3]) * 0.4 || 80;
      const base = {
        id: newId(),
        visible: true,
        locked: false,
        style: { ...defaultStyle(), fill: '#4f7cff' },
        transform: defaultTransform(),
      };
      let shape: Shape;
      const cursive = cursiveShape(type, cx, cy, size, state.shapes);
      if (cursive) {
        shape = cursive;
      } else if (type === 'rect') {
        shape = { ...base, type: 'rect', name: nextShapeName(state.shapes, 'rect'), x: cx - size / 2, y: cy - size / 2, width: size, height: size, rx: 0, ry: 0 };
      } else if (type === 'ellipse') {
        shape = { ...base, type: 'ellipse', name: nextShapeName(state.shapes, 'ellipse'), cx, cy, rx: size / 2, ry: size / 2 };
      } else if (type === 'line') {
        shape = { ...base, type: 'line', name: nextShapeName(state.shapes, 'line'), style: { ...base.style, fill: 'none', stroke: '#4f7cff', strokeWidth: Math.max(size * 0.05, 2) }, x1: cx - size / 2, y1: cy + size / 2, x2: cx + size / 2, y2: cy - size / 2 };
      } else {
        const h = size * 0.87;
        shape = {
          ...base,
          type: 'polygon',
          name: nextShapeName(state.shapes, 'polygon'),
          points: [
            [cx, cy - h / 2],
            [cx + size / 2, cy + h / 2],
            [cx - size / 2, cy + h / 2],
          ],
        };
      }
      return { shapes: [...state.shapes, shape], selectedId: shape.id, nodeEditId: null, selectedNodeIndex: null };
    });
  },


  mergeShapeIntoSelected: (type) => {
    const state = get();
    const selected = state.shapes.find((s) => s.id === state.selectedId);
    if (!selected) {
      get().addShape(type);
      return;
    }
    const b = localBounds(selected);
    const cx = b.x + b.width + Math.max(b.width * 0.15, 18);
    const cy = b.y + b.height / 2;
    const size = Math.max(Math.min(Math.max(b.width, b.height), 180), 60);
    const extra = cursiveShape(type, cx, cy, size, state.shapes);
    if (!extra) return;
    get().pushHistory();
    const merged: PathShape = {
      ...makePathShapeFrom(selected, `${selected.name} + ${extra.name}`),
      id: selected.id,
      style: { ...selected.style },
      d: `${shapeToPathData(selected)} ${shapeToPathData(extra)}`,
    } as PathShape;
    set((s) => ({
      shapes: s.shapes.map((shape) => (shape.id === selected.id ? merged : shape)),
      selectedId: selected.id,
      nodeEditId: selected.id,
      selectedNodeIndex: null,
    }));
  },

  mergeSelectedShapes: () => {
    const state = get();
    const selected = state.shapes.find((s) => s.id === state.selectedId);
    if (!selected) return;
    const unlocked = state.shapes.filter((s) => s.id !== selected.id && !s.locked && s.visible);
    if (unlocked.length === 0) return;
    const nearest = unlocked
      .map((s) => ({ s, c: boundsCenter(localBounds(s)) }))
      .sort((a, b) => Math.hypot(a.c.x - boundsCenter(localBounds(selected)).x, a.c.y - boundsCenter(localBounds(selected)).y) - Math.hypot(b.c.x - boundsCenter(localBounds(selected)).x, b.c.y - boundsCenter(localBounds(selected)).y))[0].s;
    get().pushHistory();
    const merged: PathShape = {
      ...makePathShapeFrom(selected, `${selected.name} + ${nearest.name}`),
      id: selected.id,
      style: { ...selected.style },
      d: `${shapeToPathData(selected)} ${shapeToPathData(nearest)}`,
    };
    set((s) => ({ shapes: s.shapes.filter((shape) => shape.id !== nearest.id).map((shape) => (shape.id === selected.id ? merged : shape)), selectedId: selected.id, nodeEditId: selected.id }));
  },

  resetTransform: (id) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, transform: defaultTransform() } : s)),
    }));
  },

  alignShape: (id, mode) => {
    get().pushHistory();
    set((state) => {
      const { doc } = state;
      const [vx, vy, vw, vh] = doc.viewBox;
      return {
        shapes: state.shapes.map((s) => {
          if (s.id !== id) return s;
          const b = localBounds(s);
          const c = boundsCenter(b);
          // World center of the shape's local center is (transform.x + c). We
          // move only via transform.x/y so the transformed extents shift by the
          // same delta; good enough for un-rotated align to canvas bounds.
          const worldMinX = s.transform.x + b.x;
          const worldMinY = s.transform.y + b.y;
          const t = { ...s.transform };
          if (mode === 'center-h') t.x = vx + vw / 2 - c.x;
          else if (mode === 'center-v') t.y = vy + vh / 2 - c.y;
          else if (mode === 'left') t.x += vx - worldMinX;
          else if (mode === 'right') t.x += vx + vw - (worldMinX + b.width);
          else if (mode === 'top') t.y += vy - worldMinY;
          else if (mode === 'bottom') t.y += vy + vh - (worldMinY + b.height);
          return { ...s, transform: t };
        }),
      };
    });
  },

  addNode: (id, segIndex, t = 0.5) => {
    const shape = get().shapes.find((s) => s.id === id);
    if (!shape) return;
    if (shape.type === 'path') {
      const res = insertPathNode(parsePath(shape.d), segIndex, t);
      get().pushHistory();
      set((state) => ({
        shapes: state.shapes.map((s) => (s.id === id ? ({ ...s, d: serializePath(res.commands) } as Shape) : s)),
        selectedNodeIndex: res.newIndex + 1,
      }));
    } else if (shape.type === 'polygon' || shape.type === 'polyline') {
      const poly = shape as PolyShape;
      const a = poly.points[segIndex];
      const b = poly.points[(segIndex + 1) % poly.points.length];
      if (!a || !b) return;
      const mid: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const points = poly.points.slice();
      points.splice(segIndex + 1, 0, mid);
      get().pushHistory();
      set((state) => ({
        shapes: state.shapes.map((s) => (s.id === id ? ({ ...s, points } as Shape) : s)),
        selectedNodeIndex: segIndex + 1,
      }));
    }
  },

  addNodeAfter: (id, index) => {
    const shape = get().shapes.find((s) => s.id === id);
    if (!shape) return;
    get().addNode(id, index + 1);
  },

  removeNode: (id, index) => {
    const shape = get().shapes.find((s) => s.id === id);
    if (!shape) return;
    if (shape.type === 'path') {
      const commands = parsePath(shape.d);
      const next = deletePathNode(commands, index);
      if (next === commands) return;
      get().pushHistory();
      set((state) => ({
        shapes: state.shapes.map((s) => (s.id === id ? ({ ...s, d: serializePath(next) } as Shape) : s)),
        selectedNodeIndex: null,
      }));
    } else if (shape.type === 'polygon' || shape.type === 'polyline') {
      const poly = shape as PolyShape;
      const min = shape.type === 'polygon' ? 3 : 2;
      if (poly.points.length <= min) return;
      const points = poly.points.filter((_, i) => i !== index);
      get().pushHistory();
      set((state) => ({
        shapes: state.shapes.map((s) => (s.id === id ? ({ ...s, points } as Shape) : s)),
        selectedNodeIndex: null,
      }));
    }
  },

  resetNode: (id, index) => {
    const shape = get().shapes.find((s) => s.id === id);
    if (!shape || shape.type !== 'path') return;
    const commands = parsePath(shape.d);
    const next = resetPathNode(commands, index);
    if (next === commands) return;
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? ({ ...s, d: serializePath(next) } as Shape) : s)),
    }));
  },

  pushHistory: () => {
    set((state) => ({
      past: [...state.past, { shapes: cloneShapes(state.shapes) }],
      future: [],
    }));
  },

  undo: () => {
    set((state) => {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        past: newPast,
        future: [{ shapes: cloneShapes(state.shapes) }, ...state.future],
        shapes: previous.shapes,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, { shapes: cloneShapes(state.shapes) }],
        future: newFuture,
        shapes: next.shapes,
      };
    });
  },
}));

export function makeBlankStyle(): ShapeStyle {
  return defaultStyle();
}
export function makeBlankTransform(): ShapeTransform {
  return defaultTransform();
}
