import { useEditorStore } from '../store/editorStore';

const PALETTE = [
  '#000000',
  '#ffffff',
  '#e63946',
  '#f4a261',
  '#e9c46a',
  '#2a9d8f',
  '#264653',
  '#1d4ed8',
  '#7c3aed',
  '#db2777',
  '#16a34a',
  '#94a3b8',
];

export function ColorPanel() {
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const updateStyle = useEditorStore((s) => s.updateStyle);

  const shape = shapes.find((s) => s.id === selectedId);

  if (!shape) {
    return (
      <div className="color-panel">
        <p className="tool-hint">Tap a shape on the canvas to color it</p>
        <div className="layer-chip-row">
          {shapes.map((s) => (
            <button key={s.id} className="layer-chip" onClick={() => select(s.id)}>
              <span className="layer-swatch" style={{ background: s.style.fill === 'none' ? 'transparent' : s.style.fill }} />
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const fillOn = shape.style.fill !== 'none';
  const strokeOn = shape.style.stroke !== 'none';

  return (
    <div className="color-panel">
      <div className="color-panel-title">{shape.name}</div>

      <div className="color-row">
        <label className="color-row-label">
          <input
            type="checkbox"
            checked={fillOn}
            onChange={(e) => updateStyle(shape.id, { fill: e.target.checked ? '#333333' : 'none' })}
          />
          Fill
        </label>
        {fillOn && (
          <>
            <input
              type="color"
              value={safeHex(shape.style.fill)}
              onChange={(e) => updateStyle(shape.id, { fill: e.target.value })}
              className="color-swatch-input"
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={shape.style.fillOpacity}
              onChange={(e) => updateStyle(shape.id, { fillOpacity: Number(e.target.value) })}
              className="opacity-slider"
            />
          </>
        )}
      </div>

      <div className="color-row">
        <label className="color-row-label">
          <input
            type="checkbox"
            checked={strokeOn}
            onChange={(e) => updateStyle(shape.id, { stroke: e.target.checked ? '#000000' : 'none' })}
          />
          Outline
        </label>
        {strokeOn && (
          <>
            <input
              type="color"
              value={safeHex(shape.style.stroke)}
              onChange={(e) => updateStyle(shape.id, { stroke: e.target.value })}
              className="color-swatch-input"
            />
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={shape.style.strokeWidth}
              onChange={(e) => updateStyle(shape.id, { strokeWidth: Number(e.target.value) })}
              className="opacity-slider"
            />
          </>
        )}
      </div>

      <div className="color-row">
        <label className="color-row-label">Opacity</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={shape.style.opacity}
          onChange={(e) => updateStyle(shape.id, { opacity: Number(e.target.value) })}
          className="opacity-slider full"
        />
      </div>

      <div className="palette">
        {PALETTE.map((c) => (
          <button
            key={c}
            className="palette-swatch"
            style={{ background: c }}
            onClick={() => updateStyle(shape.id, { fill: c, fillOpacity: 1 })}
          />
        ))}
      </div>

      {shapes.length > 1 && (
        <div className="layer-chip-row">
          {shapes.map((s) => (
            <button
              key={s.id}
              className={`layer-chip ${s.id === shape.id ? 'active' : ''}`}
              onClick={() => select(s.id)}
            >
              <span className="layer-swatch" style={{ background: s.style.fill === 'none' ? 'transparent' : s.style.fill }} />
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function safeHex(color: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;
  return '#000000';
}
