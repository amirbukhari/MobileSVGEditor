import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { shapesToSvgString } from '../lib/svgExport';

export function ExportPanel() {
  const shapes = useEditorStore((s) => s.shapes);
  const doc = useEditorStore((s) => s.doc);
  const [copied, setCopied] = useState(false);

  const svgString = shapesToSvgString(shapes, doc, { pretty: true });

  const download = () => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logo.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(svgString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="export-panel">
      <div className="export-preview">
        <div className="export-preview-inner" dangerouslySetInnerHTML={{ __html: svgString }} />
      </div>
      <div className="export-actions">
        <button className="btn btn-primary btn-lg" onClick={download}>
          Download SVG
        </button>
        <button className="btn btn-secondary" onClick={copy}>
          {copied ? 'Copied!' : 'Copy SVG code'}
        </button>
      </div>
      <details className="export-code">
        <summary>View SVG code</summary>
        <pre>{svgString}</pre>
      </details>
    </div>
  );
}
