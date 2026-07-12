import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { AlignMode } from '../store/editorStore';

const ALIGN_OPTIONS: { mode: AlignMode; label: string; icon: string }[] = [
  { mode: 'left', label: 'Left', icon: '⇤' },
  { mode: 'center-h', label: 'Center', icon: '↔' },
  { mode: 'right', label: 'Right', icon: '⇥' },
  { mode: 'top', label: 'Top', icon: '⇧' },
  { mode: 'center-v', label: 'Middle', icon: '↕' },
  { mode: 'bottom', label: 'Bottom', icon: '⇩' },
];

export function LayersSheet() {
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);
  const toggleLocked = useEditorStore((s) => s.toggleLocked);
  const renameShape = useEditorStore((s) => s.renameShape);
  const mergeShapes = useEditorStore((s) => s.mergeShapes);
  const alignShapes = useEditorStore((s) => s.alignShapes);
  const layersOpen = useEditorStore((s) => s.layersOpen);
  const setLayersOpen = useEditorStore((s) => s.setLayersOpen);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [multiMode, setMultiMode] = useState(false);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  if (!layersOpen) return null;

  const ordered = [...shapes].reverse();

  const commitRename = () => {
    if (editingId && editValue.trim()) renameShape(editingId, editValue.trim());
    setEditingId(null);
  };

  const exitMulti = () => {
    setMultiMode(false);
    setMultiSelected([]);
    setShowAlignMenu(false);
  };

  const toggleMultiPick = (id: string) => {
    setMultiSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  return (
    <div className="sheet-backdrop" onClick={() => setLayersOpen(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>Layers</h2>
          <div className="sheet-header-actions">
            {shapes.length > 1 && (
              <button
                className={`text-btn ${multiMode ? 'active' : ''}`}
                onClick={() => (multiMode ? exitMulti() : setMultiMode(true))}
              >
                {multiMode ? 'Done' : 'Select'}
              </button>
            )}
            <button className="icon-btn" onClick={() => setLayersOpen(false)}>
              ✕
            </button>
          </div>
        </div>
        <div className="layers-list">
          {ordered.length === 0 && <p className="layers-empty">No shapes</p>}
          {ordered.map((shape) => {
            const picked = multiMode && multiSelected.includes(shape.id);
            return (
              <div
                key={shape.id}
                className={`layer-row ${(multiMode ? picked : shape.id === selectedId) ? 'active' : ''}`}
                onClick={() => {
                  if (editingId === shape.id) return;
                  if (multiMode) {
                    toggleMultiPick(shape.id);
                    return;
                  }
                  select(shape.id);
                  setLayersOpen(false);
                }}
              >
                {multiMode && <span className={`layer-checkbox ${picked ? 'checked' : ''}`}>{picked ? '✓' : ''}</span>}
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
                      if (multiMode) return;
                      e.stopPropagation();
                      setEditingId(shape.id);
                      setEditValue(shape.name);
                    }}
                  >
                    {shape.name}
                  </span>
                )}
                {!multiMode && (
                  <>
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
                  </>
                )}
              </div>
            );
          })}
        </div>

        {multiMode && (
          <div className="multi-select-bar">
            <div className="multi-select-row">
              <span className="multi-select-count">{multiSelected.length} selected</span>
              <button
                className="btn btn-secondary"
                disabled={multiSelected.length < 2}
                onClick={() => setShowAlignMenu((v) => !v)}
              >
                Align
              </button>
              <button
                className="btn btn-primary"
                disabled={multiSelected.length < 2}
                onClick={() => {
                  mergeShapes(multiSelected);
                  exitMulti();
                  setLayersOpen(false);
                }}
              >
                Merge
              </button>
            </div>
            {showAlignMenu && (
              <div className="align-menu">
                {ALIGN_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    className="align-btn"
                    onClick={() => {
                      alignShapes(multiSelected, opt.mode);
                      setShowAlignMenu(false);
                    }}
                  >
                    <span className="tool-icon">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
