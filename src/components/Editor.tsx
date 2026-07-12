import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { TopBar } from './TopBar';
import { Canvas, type CanvasHandle } from './Canvas';
import { ZoomControls } from './ZoomControls';
import { BottomToolbar } from './BottomToolbar';
import { LayersSheet } from './LayersSheet';
import { SimplifySheet } from './SimplifySheet';
import { TransformPanel } from './TransformPanel';
import { ColorPanel } from './ColorPanel';
import { ExportPanel } from './ExportPanel';

export function Editor() {
  const step = useEditorStore((s) => s.step);
  const canvasRef = useRef<CanvasHandle>(null);

  // Desktop keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const s = useEditorStore.getState();
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key;

      if (meta && key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (meta && key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (meta && key.toLowerCase() === 'd') {
        e.preventDefault();
        if (s.selectedId) s.duplicateShape(s.selectedId);
        return;
      }
      if (key === '=' || key === '+') {
        e.preventDefault();
        canvasRef.current?.zoomIn();
        return;
      }
      if (key === '-' || key === '_') {
        e.preventDefault();
        canvasRef.current?.zoomOut();
        return;
      }
      if (key === '0') {
        e.preventDefault();
        canvasRef.current?.fit();
        return;
      }
      if (key === 'Escape') {
        if (s.nodeEditId) s.toggleNodeEdit(null);
        else if (s.selectedId) s.select(null);
        return;
      }
      if (key === 'Delete' || key === 'Backspace') {
        if (s.nodeEditId && s.selectedNodeIndex !== null) {
          e.preventDefault();
          s.removeNode(s.nodeEditId, s.selectedNodeIndex);
          return;
        }
        if (s.selectedId && s.step === 'shape' && !s.nodeEditId) {
          e.preventDefault();
          s.deleteShape(s.selectedId);
          return;
        }
      }
      if (
        s.selectedId &&
        s.step === 'shape' &&
        !s.nodeEditId &&
        (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight')
      ) {
        const shape = s.shapes.find((sh) => sh.id === s.selectedId);
        if (!shape || shape.locked) return;
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = key === 'ArrowLeft' ? -d : key === 'ArrowRight' ? d : 0;
        const dy = key === 'ArrowUp' ? -d : key === 'ArrowDown' ? d : 0;
        s.updateTransform(s.selectedId, { x: shape.transform.x + dx, y: shape.transform.y + dy }, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="editor">
      <TopBar />
      <div className="editor-canvas-area">
        <Canvas ref={canvasRef} />
        <ZoomControls canvasRef={canvasRef} />
      </div>
      <div className="editor-bottom">
        {step === 'shape' && <BottomToolbar />}
        {step === 'color' && <ColorPanel />}
        {step === 'export' && <ExportPanel />}
      </div>
      <LayersSheet />
      <SimplifySheet />
      <TransformPanel />
    </div>
  );
}
