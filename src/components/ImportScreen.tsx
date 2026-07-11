import { useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';

export function ImportScreen() {
  const loadFromSvgString = useEditorStore((s) => s.loadFromSvgString);
  const loadStarter = useEditorStore((s) => s.loadStarter);
  const loadBlank = useEditorStore((s) => s.loadBlank);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    file
      .text()
      .then((text) => {
        try {
          loadFromSvgString(text);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not read that file.');
        }
      })
      .catch(() => setError('Could not read that file.'));
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onPasteSubmit = () => {
    try {
      loadFromSvgString(pasteText);
      setPasteOpen(false);
      setPasteText('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That does not look like valid SVG.');
    }
  };

  return (
    <div className="import-screen">
      <div className="import-hero">
        <h1>Logo Editor</h1>
        <p>Get your shapes perfect first. Colors come next.</p>
      </div>

      {error && <div className="import-error">{error}</div>}

      <div className="import-actions">
        <button className="btn btn-primary btn-lg" onClick={() => fileInputRef.current?.click()}>
          Upload your SVG logo
        </button>
        <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml" onChange={onFileChange} hidden />

        <button className="btn btn-secondary btn-lg" onClick={() => setPasteOpen((v) => !v)}>
          Paste SVG code
        </button>

        {pasteOpen && (
          <div className="paste-panel">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="<svg>...</svg>"
              rows={6}
            />
            <button className="btn btn-primary" onClick={onPasteSubmit} disabled={!pasteText.trim()}>
              Use this SVG
            </button>
          </div>
        )}

        <div className="import-start-row">
          <button className="btn btn-ghost" onClick={loadBlank}>
            Start on a blank canvas
          </button>
          <button className="btn btn-ghost" onClick={loadStarter}>
            Try sample shapes
          </button>
        </div>
      </div>
    </div>
  );
}
