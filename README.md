# Logo Editor

A mobile-first web app for adjusting an SVG logo's shapes first, then colors.

## Workflow

1. **Shape** — upload or paste your SVG, then tap any shape to move (drag body), scale
   (drag corner/edge handles), or rotate it (drag the top handle). Paths and
   polygons also support fine-grained node editing ("Edit points") for
   reshaping individual anchor/control points. Duplicate, delete, flip, and
   reorder shapes from the bottom toolbar; use the Layers panel to select,
   hide, or lock shapes that overlap.
2. **Color** — pick fill/outline colors, opacity, and stroke width per shape,
   with a quick preset palette.
3. **Export** — download the edited SVG or copy its code.

The canvas supports pinch-to-zoom, drag-to-pan, and buttons for zoom
in/out/fit, all designed for touch.

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
