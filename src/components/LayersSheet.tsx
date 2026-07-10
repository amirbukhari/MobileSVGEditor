import { useEditorStore } from '../store/editorStore';

export function LayersSheet() {
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);
  const toggleLocked = useEditorStore((s) => s.toggleLocked);
  const layersOpen = useEditorStore((s) => s.layersOpen);
  const setLayersOpen = useEditorStore((s) => s.setLayersOpen);

  if (!layersOpen) return null;

  const ordered = [...shapes].reverse();

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
                select(shape.id);
                setLayersOpen(false);
              }}
            >
              <span className="layer-swatch" style={{ background: shape.style.fill === 'none' ? 'transparent' : shape.style.fill }} />
              <span className="layer-name">{shape.name}</span>
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
