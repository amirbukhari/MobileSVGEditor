import { useEditorStore } from '../store/editorStore';
import { countSubpaths, nodeIsCurve, parsePath } from '../lib/pathData';

const ADD_TOOLS: { type: 'rect' | 'ellipse' | 'line' | 'triangle'; icon: string; label: string }[] = [
  { type: 'rect', icon: '▭', label: 'Rect' },
  { type: 'ellipse', icon: '◯', label: 'Ellipse' },
  { type: 'line', icon: '╱', label: 'Line' },
  { type: 'triangle', icon: '△', label: 'Triangle' },
];

export function BottomToolbar() {
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const nodeEditId = useEditorStore((s) => s.nodeEditId);
  const selectedNodeIndex = useEditorStore((s) => s.selectedNodeIndex);
  const toggleNodeEdit = useEditorStore((s) => s.toggleNodeEdit);
  const addShape = useEditorStore((s) => s.addShape);
  const duplicateShape = useEditorStore((s) => s.duplicateShape);
  const deleteShape = useEditorStore((s) => s.deleteShape);
  const reorderShape = useEditorStore((s) => s.reorderShape);
  const flipShape = useEditorStore((s) => s.flipShape);
  const breakApartShape = useEditorStore((s) => s.breakApartShape);
  const alignShape = useEditorStore((s) => s.alignShape);
  const resetTransform = useEditorStore((s) => s.resetTransform);
  const removeNode = useEditorStore((s) => s.removeNode);
  const resetNode = useEditorStore((s) => s.resetNode);
  const setLayersOpen = useEditorStore((s) => s.setLayersOpen);
  const setSimplifyOpen = useEditorStore((s) => s.setSimplifyOpen);

  const shape = shapes.find((s) => s.id === selectedId);
  const isNodeEditable = shape && (shape.type === 'path' || shape.type === 'polygon' || shape.type === 'polyline');
  const inNodeEdit = shape && nodeEditId === shape.id;
  const isBreakable = shape && shape.type === 'path' && countSubpaths(shape.d) > 1;

  // ---- Node editing toolbar ----
  if (inNodeEdit && shape) {
    const hasSelected = selectedNodeIndex !== null;
    const selectedIsCurve =
      shape.type === 'path' && selectedNodeIndex !== null && nodeIsCurve(parsePath(shape.d), selectedNodeIndex);
    return (
      <div className="bottom-toolbar">
        <button className="tool-btn active" onClick={() => toggleNodeEdit(null)}>
          <span className="tool-icon">✓</span>
          Done
        </button>
        <button
          className="tool-btn tool-danger"
          disabled={!hasSelected}
          onClick={() => selectedNodeIndex !== null && removeNode(shape.id, selectedNodeIndex)}
        >
          <span className="tool-icon">✕</span>
          Delete point
        </button>
        <button
          className="tool-btn"
          disabled={!selectedIsCurve}
          onClick={() => selectedNodeIndex !== null && resetNode(shape.id, selectedNodeIndex)}
        >
          <span className="tool-icon">⌐</span>
          Make corner
        </button>
        <div className="tool-hint">Tap a segment to add a point · tap a point to select, then drag</div>
      </div>
    );
  }

  return (
    <div className="bottom-toolbar">
      <button className="tool-btn" onClick={() => setLayersOpen(true)}>
        <span className="tool-icon">☰</span>
        Layers
      </button>

      {ADD_TOOLS.map((t) => (
        <button key={t.type} className="tool-btn" onClick={() => addShape(t.type)}>
          <span className="tool-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}

      {shape && !shape.locked && (
        <>
          <span className="tool-sep" />
          {isNodeEditable && (
            <button className="tool-btn" onClick={() => toggleNodeEdit(shape.id)}>
              <span className="tool-icon">✎</span>
              Edit points
            </button>
          )}
          {isNodeEditable && (
            <button className="tool-btn" onClick={() => setSimplifyOpen(true)}>
              <span className="tool-icon">✂</span>
              Simplify
            </button>
          )}
          {isBreakable && (
            <button className="tool-btn" onClick={() => breakApartShape(shape.id)}>
              <span className="tool-icon">◫</span>
              Break Apart
            </button>
          )}
          <button className="tool-btn" onClick={() => flipShape(shape.id, 'h')}>
            <span className="tool-icon">⇋</span>
            Flip H
          </button>
          <button className="tool-btn" onClick={() => flipShape(shape.id, 'v')}>
            <span className="tool-icon">⇵</span>
            Flip V
          </button>
          <button className="tool-btn" onClick={() => alignShape(shape.id, 'center-h')}>
            <span className="tool-icon">↔</span>
            Center H
          </button>
          <button className="tool-btn" onClick={() => alignShape(shape.id, 'center-v')}>
            <span className="tool-icon">↕</span>
            Center V
          </button>
          <button className="tool-btn" onClick={() => reorderShape(shape.id, 'front')}>
            <span className="tool-icon">⬆</span>
            Front
          </button>
          <button className="tool-btn" onClick={() => reorderShape(shape.id, 'back')}>
            <span className="tool-icon">⬇</span>
            Back
          </button>
          <button className="tool-btn" onClick={() => resetTransform(shape.id)}>
            <span className="tool-icon">⟲</span>
            Reset
          </button>
          <button className="tool-btn" onClick={() => duplicateShape(shape.id)}>
            <span className="tool-icon">⧉</span>
            Duplicate
          </button>
          <button className="tool-btn tool-danger" onClick={() => deleteShape(shape.id)}>
            <span className="tool-icon">🗑</span>
            Delete
          </button>
        </>
      )}

      {!shape && <div className="tool-hint">Add a shape above, or tap a shape to select it</div>}
    </div>
  );
}
