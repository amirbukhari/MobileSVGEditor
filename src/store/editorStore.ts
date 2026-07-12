import { create } from 'zustand';
import type { EditorStep, PathShape, Shape, ShapeStyle, ShapeTransform, SvgDoc } from '../types';
import { defaultStyle, defaultTransform } from '../types';
import { parseSvgString, starterShapes } from '../lib/svgImport';
import { parsePath, serializePath, splitSubpaths } from '../lib/pathData';
import { applyTransformToPoint, boundsCenter, localBounds, worldBounds } from '../lib/geometry';
import { shapeToPathCommands } from '../lib/shapeToPath';

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';

interface HistoryEntry {
  shapes: Shape[];
}

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `shape_${Date.now().toString(36)}_${idCounter}_${Math.floor(Math.random() * 100000)}`;
}

interface EditorState {
  hasDocument: boolean;
  doc: SvgDoc;
  shapes: Shape[];
  selectedId: string | null;
  step: EditorStep;
  nodeEditId: string | null;
  layersOpen: boolean;
  simplifyOpen: boolean;
  transformPanelOpen: boolean;

  past: HistoryEntry[];
  future: HistoryEntry[];

  // File loading
  loadFromSvgString: (svgText: string) => void;
  loadStarter: () => void;
  reset: () => void;

  // Selection / navigation
  select: (id: string | null) => void;
  setStep: (step: EditorStep) => void;
  toggleNodeEdit: (id: string | null) => void;
  setLayersOpen: (open: boolean) => void;
  setSimplifyOpen: (open: boolean) => void;
  setTransformPanelOpen: (open: boolean) => void;

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
  mergeShapes: (ids: string[]) => void;
  alignShapes: (ids: string[], mode: AlignMode) => void;
  centerShape: (id: string, axis: 'h' | 'v' | 'both') => void;
  nudgeShape: (id: string, dx: number, dy: number) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

function cloneShapes(shapes: Shape[]): Shape[] {
  return shapes.map((s) => ({ ...s, style: { ...s.style }, transform: { ...s.transform } }));
}

let pendingSnapshot: Shape[] | null = null;

export const useEditorStore = create<EditorState>((set, get) => ({
  hasDocument: false,
  doc: { width: 200, height: 200, viewBox: [0, 0, 200, 200] },
  shapes: [],
  selectedId: null,
  step: 'shape',
  nodeEditId: null,
  layersOpen: false,
  simplifyOpen: false,
  transformPanelOpen: false,
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
      past: [],
      future: [],
    });
  },

  select: (id) => set({ selectedId: id, nodeEditId: null }),
  setStep: (step) => set({ step, nodeEditId: null }),
  toggleNodeEdit: (id) => set({ nodeEditId: id }),
  setLayersOpen: (open) => set({ layersOpen: open }),
  setSimplifyOpen: (open) => set({ simplifyOpen: open }),
  setTransformPanelOpen: (open) => set({ transformPanelOpen: open }),

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

  mergeShapes: (ids) => {
    const state0 = get();
    const toMerge = ids
      .map((id) => state0.shapes.find((s) => s.id === id))
      .filter((s): s is Shape => !!s);
    if (toMerge.length < 2) return;

    get().pushHistory();
    set((state) => {
      const indices = ids
        .map((id) => state.shapes.findIndex((s) => s.id === id))
        .filter((i) => i !== -1);
      if (indices.length < 2) return state;
      const maxIdx = Math.max(...indices);

      const allCommands = toMerge.flatMap((shape) => {
        const local = shapeToPathCommands(shape);
        const center = boundsCenter(localBounds(shape));
        return local.map((c) => ({
          ...c,
          point: c.point ? applyTransformToPoint(c.point, shape.transform, center) : undefined,
          controls: c.controls?.map((cc) => applyTransformToPoint(cc, shape.transform, center)),
        }));
      });

      const topShape = toMerge[toMerge.length - 1];
      const merged: PathShape = {
        id: genId(),
        type: 'path',
        name: 'Merged Path',
        visible: true,
        locked: false,
        style: { ...topShape.style },
        transform: defaultTransform(),
        d: serializePath(allCommands),
      };

      const shapes = state.shapes.filter((s) => !ids.includes(s.id));
      const removedBeforeMax = indices.filter((i) => i < maxIdx).length;
      const insertPos = Math.min(maxIdx - removedBeforeMax, shapes.length);
      shapes.splice(insertPos, 0, merged);
      return { shapes, selectedId: merged.id };
    });
  },

  alignShapes: (ids, mode) => {
    const state0 = get();
    const targets = ids
      .map((id) => state0.shapes.find((s) => s.id === id))
      .filter((s): s is Shape => !!s);
    if (targets.length < 2) return;

    const boxes = targets.map((s) => ({ id: s.id, box: worldBounds(s) }));
    const unionX = Math.min(...boxes.map((b) => b.box.x));
    const unionY = Math.min(...boxes.map((b) => b.box.y));
    const unionRight = Math.max(...boxes.map((b) => b.box.x + b.box.width));
    const unionBottom = Math.max(...boxes.map((b) => b.box.y + b.box.height));
    const unionCenterX = (unionX + unionRight) / 2;
    const unionCenterY = (unionY + unionBottom) / 2;

    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) => {
        const entry = boxes.find((b) => b.id === s.id);
        if (!entry) return s;
        const { box } = entry;
        let dx = 0;
        let dy = 0;
        switch (mode) {
          case 'left':
            dx = unionX - box.x;
            break;
          case 'right':
            dx = unionRight - (box.x + box.width);
            break;
          case 'top':
            dy = unionY - box.y;
            break;
          case 'bottom':
            dy = unionBottom - (box.y + box.height);
            break;
          case 'center-h':
            dx = unionCenterX - (box.x + box.width / 2);
            break;
          case 'center-v':
            dy = unionCenterY - (box.y + box.height / 2);
            break;
        }
        return { ...s, transform: { ...s.transform, x: s.transform.x + dx, y: s.transform.y + dy } };
      }),
    }));
  },

  centerShape: (id, axis) => {
    const state0 = get();
    const shape = state0.shapes.find((s) => s.id === id);
    if (!shape) return;
    const box = worldBounds(shape);
    const [vx, vy, vw, vh] = state0.doc.viewBox;
    const canvasCenterX = vx + vw / 2;
    const canvasCenterY = vy + vh / 2;
    const dx = axis !== 'v' ? canvasCenterX - (box.x + box.width / 2) : 0;
    const dy = axis !== 'h' ? canvasCenterY - (box.y + box.height / 2) : 0;

    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) =>
        s.id === id ? { ...s, transform: { ...s.transform, x: s.transform.x + dx, y: s.transform.y + dy } } : s
      ),
    }));
  },

  nudgeShape: (id, dx, dy) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((s) =>
        s.id === id ? { ...s, transform: { ...s.transform, x: s.transform.x + dx, y: s.transform.y + dy } } : s
      ),
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
