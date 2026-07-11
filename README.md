# Logo Editor

A web app for adjusting an SVG logo's shapes first, then colors. Works on both
touch (phones/tablets) and desktop (mouse + keyboard).

## Workflow

1. **Shape** — upload or paste your SVG, or start from a blank canvas. Add new
   primitives (rectangle, ellipse, line, triangle) from the toolbar, then tap a
   shape to move (drag body), scale (corner/edge handles), or rotate (top
   handle). Center, flip, reorder, duplicate, reset, or delete from the bottom
   toolbar; use the Layers panel for overlapping shapes.

   Paths and polygons support full node editing via **Edit points**:
   - **Tap a point** to select it, then drag to reshape (or drag its bezier
     handles).
   - **Tap a segment** to add a point there (curves subdivide without changing
     the shape).
   - **Delete point** removes the selected node; **Make corner** strips a
     curve node's bezier handles.

   Selection handles and edit points stay a **constant on-screen size** at any
   zoom level, so they never balloon or shrink out of reach.
2. **Color** — pick fill/outline colors, opacity, and stroke width per shape,
   with a quick preset palette.
3. **Export** — download the edited SVG or copy its code.

### Navigation

- **Touch:** pinch-to-zoom, drag-to-pan, and on-screen zoom in/out/fit buttons.
- **Desktop:** mouse-wheel zoom (centered on the cursor) plus keyboard
  shortcuts:
  - `Ctrl/⌘+Z` undo, `Ctrl/⌘+Shift+Z` / `Ctrl+Y` redo
  - `Ctrl/⌘+D` duplicate, `Delete`/`Backspace` remove shape or point
  - Arrow keys nudge (`Shift` for larger steps), `Esc` deselect / exit editing
  - `+` / `-` zoom, `0` fit to screen

## Development

```bash
npm install
npm run dev      # start local dev server
npm run build    # type-check + production build
npm run lint     # oxlint
```

## Architecture

- `src/types.ts` — shape/style/transform data model.
- `src/lib/svgImport.ts` / `svgExport.ts` — parse an uploaded SVG into the
  internal shape model and serialize it back out.
- `src/lib/pathData.ts` — minimal SVG path (`d`) parser/serializer exposing
  editable anchor/control points.
- `src/lib/geometry.ts` / `transformMath.ts` — bounding-box math and the
  pointer-drag math behind move/scale/rotate handles.
- `src/store/editorStore.ts` — zustand store: shapes, selection, undo/redo.
- `src/components/` — Canvas (pan/zoom + hit testing), TransformHandles,
  NodeEditor, and the step-based UI (TopBar, BottomToolbar, ColorPanel,
  ExportPanel, LayersSheet).
