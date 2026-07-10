import type { CanvasHandle } from './Canvas';

interface Props {
  canvasRef: React.RefObject<CanvasHandle | null>;
}

export function ZoomControls({ canvasRef }: Props) {
  return (
    <div className="zoom-controls">
      <button className="icon-btn" onClick={() => canvasRef.current?.zoomOut()} aria-label="Zoom out">
        −
      </button>
      <button className="icon-btn" onClick={() => canvasRef.current?.fit()} aria-label="Fit to screen">
        ⤢
      </button>
      <button className="icon-btn" onClick={() => canvasRef.current?.zoomIn()} aria-label="Zoom in">
        +
      </button>
    </div>
  );
}
