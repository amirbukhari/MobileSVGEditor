import { useEditorStore } from '../store/editorStore';

export function BottomToolbar() {
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const nodeEditId = useEditorStore((s) => s.nodeEditId);
  const toggleNodeEdit = useEditorStore((s) => s.toggleNodeEdit);
  const duplicateShape = useEditorStore((s) => s.duplicateShape);
  const deleteShape = useEditorStore((s) => s.deleteShape);
  const reorderShape = useEditorStore((s) => s.reorderShape);
  const flipShape = useEditorStore((s) => s.flipShape);
  const setLayersOpen = useEditorStore((s) => s.setLayersOpen);

  const shape = shapes.find((s) => s.id === selectedId);
  const isNodeEditable = shape && (shape.type === 'path' || shape.type === 'polygon' || shape.type === 'polyline');
  const inNodeEdit = shape && nodeEditId === shape.id;

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
