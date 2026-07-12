import { useEditorStore } from '../store/editorStore';

const NUDGE_STEP = 1;
const NUDGE_STEP_BIG = 10;

export function TransformPanel() {
  const shapes = useEditorStore((s) => s.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const transformPanelOpen = useEditorStore((s) => s.transformPanelOpen);
  const setTransformPanelOpen = useEditorStore((s) => s.setTransformPanelOpen);
  const updateTransform = useEditorStore((s) => s.updateTransform);
  const commitTransform = useEditorStore((s) => s.commitTransform);
  const nudgeShape = useEditorStore((s) => s.nudgeShape);
  const centerShape = useEditorStore((s) => s.centerShape);

  const shape = shapes.find((s) => s.id === selectedId);

  if (!transformPanelOpen || !shape) return null;

  const { x, y, rotate, scaleX, scaleY } = shape.transform;
  const scalePct = Math.round(Math.abs((scaleX + scaleY) / 2) * 100);

  const setField = (patch: Partial<typeof shape.transform>) => {
    updateTransform(shape.id, patch, true);
  };

  const setScalePct = (pct: number) => {
    const factor = pct / 100;
    updateTransform(
      shape.id,
      { scaleX: factor * Math.sign(scaleX || 1), scaleY: factor * Math.sign(scaleY || 1) },
      true
    );
  };

  const nudge = (dx: number, dy: number) => nudgeShape(shape.id, dx, dy);

  return (
    <div className="sheet-backdrop" onClick={() => setTransformPanelOpen(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>Position &amp; Size</h2>
          <button className="icon-btn" onClick={() => setTransformPanelOpen(false)}>
            ✕
          </button>
        </div>

        <div className="transform-fields">
          <label className="transform-field">
            <span>X</span>
            <input
              type="number"
              value={round(x)}
              onChange={(e) => setField({ x: Number(e.target.value) })}
              onBlur={() => commitTransform()}
            />
          </label>
          <label className="transform-field">
            <span>Y</span>
            <input
              type="number"
              value={round(y)}
              onChange={(e) => setField({ y: Number(e.target.value) })}
              onBlur={() => commitTransform()}
            />
          </label>
          <label className="transform-field">
            <span>Rotate °</span>
            <input
              type="number"
              value={round(rotate)}
              onChange={(e) => setField({ rotate: Number(e.target.value) })}
              onBlur={() => commitTransform()}
            />
          </label>
          <label className="transform-field">
            <span>Scale %</span>
            <input
              type="number"
              value={scalePct}
              onChange={(e) => setScalePct(Number(e.target.value))}
              onBlur={() => commitTransform()}
            />
          </label>
        </div>

        <div className="nudge-section">
          <span className="nudge-label">Nudge</span>
          <div className="nudge-pad">
            <span />
            <button className="icon-btn" onClick={() => nudge(0, -NUDGE_STEP)}>
              ↑
            </button>
            <span />
            <button className="icon-btn" onClick={() => nudge(-NUDGE_STEP, 0)}>
              ←
            </button>
            <span className="nudge-center" aria-hidden="true">
              •
            </span>
            <button className="icon-btn" onClick={() => nudge(NUDGE_STEP, 0)}>
              →
            </button>
            <span />
            <button className="icon-btn" onClick={() => nudge(0, NUDGE_STEP)}>
              ↓
            </button>
            <span />
          </div>
          <div className="nudge-big-row">
            <button className="text-btn" onClick={() => nudge(-NUDGE_STEP_BIG, 0)}>
              ← {NUDGE_STEP_BIG}
            </button>
            <button className="text-btn" onClick={() => nudge(NUDGE_STEP_BIG, 0)}>
              {NUDGE_STEP_BIG} →
            </button>
            <button className="text-btn" onClick={() => nudge(0, -NUDGE_STEP_BIG)}>
              ↑ {NUDGE_STEP_BIG}
            </button>
            <button className="text-btn" onClick={() => nudge(0, NUDGE_STEP_BIG)}>
              {NUDGE_STEP_BIG} ↓
            </button>
          </div>
        </div>

        <div className="export-actions">
          <button className="btn btn-secondary" onClick={() => centerShape(shape.id, 'h')}>
            Center Horiz.
          </button>
          <button className="btn btn-secondary" onClick={() => centerShape(shape.id, 'v')}>
            Center Vert.
          </button>
        </div>
        <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => centerShape(shape.id, 'both')}>
          Center on Canvas
        </button>
      </div>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
