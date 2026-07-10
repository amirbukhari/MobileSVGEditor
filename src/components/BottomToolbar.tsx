import { useEditorStore } from '../store/editorStore';
import { countSubpaths } from '../lib/pathData';

export function BottomToolbar() {
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const nodeEditId = useEditorStore((s) => s.nodeEditId);
  const toggleNodeEdit = useEditorStore((s) => s.toggleNodeEdit);
  const duplicateShape = useEditorStore((s) => s.duplicateShape);
  const deleteShape = useEditorStore((s) => s.deleteShape);
  const reorderShape = useEditorStore((s) => s.reorderShape);
  const flipShape = useEditorStore((s) => s.flipShape);
  const breakApartShape = useEditorStore((s) => s.breakApartShape);
  const setLayersOpen = useEditorStore((s) => s.setLayersOpen);
  const setSimplifyOpen = useEditorStore((s) => s.setSimplifyOpen);

  const shape = shapes.find((s) => s.id === selectedId);
  const isNodeEditable = shape && (shape.type === 'path' || shape.type === 'polygon' || shape.type === 'polyline');
  const inNodeEdit = shape && nodeEditId === shape.id;
  const isBreakable = shape && shape.type === 'path' && countSubpaths(shape.d) > 1;

  return (
    <div className="bottom-toolbar">
      <button className="tool-btn" onClick={() => setLayersOpen(true)}>
        <span className="tool-icon">☰</span>
        Layers
      </button>

      {shape && !shape.locked && (
        <>
          {isNodeEditable && (
            <button
              className={`tool-btn ${inNodeEdit ? 'active' : ''}`}
              onClick={() => toggleNodeEdit(inNodeEdit ? null : shape.id)}
            >
              <span className="tool-icon">✎</span>
              {inNodeEdit ? 'Done editing' : 'Edit points'}
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
          <button className="tool-btn" onClick={() => reorderShape(shape.id, 'front')}>
            <span className="tool-icon">⬆</span>
            Front
          </button>
          <button className="tool-btn" onClick={() => reorderShape(shape.id, 'back')}>
            <span className="tool-icon">⬇</span>
            Back
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

      {!shape && <div className="tool-hint">Tap a shape on the canvas to select it</div>}
    </div>
  );
}
