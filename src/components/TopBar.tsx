import { useEditorStore } from '../store/editorStore';
import type { EditorStep } from '../types';

const STEPS: { key: EditorStep; label: string; num: number }[] = [
  { key: 'shape', label: 'Shape', num: 1 },
  { key: 'color', label: 'Color', num: 2 },
  { key: 'export', label: 'Export', num: 3 },
];

export function TopBar() {
  const step = useEditorStore((s) => s.step);
  const setStep = useEditorStore((s) => s.setStep);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const reset = useEditorStore((s) => s.reset);

  return (
    <div className="top-bar">
      <button className="icon-btn" onClick={reset} aria-label="Start over" title="Start over">
        ✕
      </button>
      <div className="step-tabs">
        {STEPS.map((s) => (
          <button
            key={s.key}
            className={`step-tab ${step === s.key ? 'active' : ''}`}
            onClick={() => setStep(s.key)}
          >
            <span className="step-num">{s.num}</span>
            {s.label}
          </button>
        ))}
      </div>
      <div className="history-btns">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo">
          ↶
        </button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo">
          ↷
        </button>
      </div>
    </div>
  );
}
