import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';

export function LayersSheet() {
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);
  const toggleLocked = useEditorStore((s) => s.toggleLocked);
  const renameShape = useEditorStore((s) => s.renameShape);
  const layersOpen = useEditorStore((s) => s.layersOpen);
  const setLayersOpen = useEditorStore((s) => s.setLayersOpen);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!layersOpen) return null;

  const ordered = [...shapes].reverse();

  const commitRename = () => {
    if (editingId && editValue.trim()) renameShape(editingId, editValue.trim());
    setEditingId(null);
  };

  return (
    <div className="sheet-backdrop" onClick={() => setLayersOpen(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>Layers</h2>
          <button className="icon-btn" onClick={() => setLayersOpen(false)}>
            ✕
          </button>
        </div>
        <div className="layers-list">
          {ordered.length === 0 && <p className="layers-empty">No shapes</p>}
          {ordered.map((shape) => (
            <div
              key={shape.id}
              className={`layer-row ${shape.id === selectedId ? 'active' : ''}`}
              onClick={() => {
                if (editingId === shape.id) return;
                select(shape.id);
                setLayersOpen(false);
              }}
            >
              <span className="layer-swatch" style={{ background: shape.style.fill === 'none' ? 'transparent' : shape.style.fill }} />
              {editingId === shape.id ? (
                <input
                  className="layer-name-input"
                  value={editValue}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <span
                  className="layer-name"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(shape.id);
                    setEditValue(shape.name);
                  }}
                >
                  {shape.name}
                </span>
              )}
              <button
                className="icon-btn small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLocked(shape.id);
                }}
                title={shape.locked ? 'Unlock' : 'Lock'}
              >
                {shape.locked ? '🔒' : '🔓'}
              </button>
              <button
                className="icon-btn small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisible(shape.id);
                }}
                title={shape.visible ? 'Hide' : 'Show'}
              >
                {shape.visible ? '👁' : '🚫'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
