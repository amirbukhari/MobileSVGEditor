import { create } from 'zustand';
import type { EditorStep, Shape, ShapeStyle, ShapeTransform, SvgDoc } from '../types';
import { defaultStyle, defaultTransform } from '../types';
import { parseSvgString, starterShapes } from '../lib/svgImport';

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
  layersOpen: boolean;

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

  // Editing
  updateTransform: (id: string, patch: Partial<ShapeTransform>, commit?: boolean) => void;
  commitTransform: () => void;
  updateStyle: (id: string, patch: Partial<ShapeStyle>) => void;
  updateShapeGeometry: (id: string, patch: Partial<Shape>) => void;
  updateGeometryLive: (id: string, patch: Partial<Shape>) => void;
  commitPending: () => void;
  renameShape: (id: string, name: string) => void;
  toggleVisible: (id: string) => void;
  toggleLocked: (id: string) => void;
  duplicateShape: (id: string) => void;
  deleteShape: (id: string) => void;
  reorderShape: (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => void;
  flipShape: (id: string, axis: 'h' | 'v') => void;

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
