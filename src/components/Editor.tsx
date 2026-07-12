import { useRef } from 'react';
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
