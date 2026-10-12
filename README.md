# clear-draggable

Pointer-based drag-and-drop + resize primitives for React 19.3. Zero runtime dependencies.

- **Drag** — free dragging with bounds and grid snap
- **Resize** — 8 handles, min/max, aspect ratio, N/W handles move the box origin
- **Sortable / Kanban / Dashboard grid** — group wrappers built on React 19.3 Fragment Refs
- Cursor-following drag ghosts, drop-target highlighting
- Vitest suite, live sandbox, Vercel-ready

## Requirements

- `react ^19.3`, `react-dom ^19.3` (peer dependencies)
- The library relies on React 19.3 Fragment Refs (`<Fragment ref>`) for measuring
  item groups without extra wrapper divs.

## Install

```bash
npm install clear-draggable
```

> v0.1 lives in `src/lib` of this repo and is published via `npm run build:lib`
> (`dist-lib`, es + cjs + dts). The sandbox in `src/demo` imports it from source.

## Usage

### Free dragging

```tsx
import { Draggable } from 'clear-draggable'

<Draggable defaultPosition={{ x: 40, y: 20 }} bounds={{ minX: 0, minY: 0 }} grid={16}>
  <div>drag me</div>
</Draggable>
```

Or the hook, when you need your own node:

```tsx
import { useDraggable } from 'clear-draggable'

const { position, isDragging, dragHandleProps } = useDraggable({
  defaultPosition: { x: 0, y: 0 },
  bounds: { minX: 0, minY: 0, maxX: 400, maxY: 300 },
  grid: 8, // snap step in px, 0 = off
  onDragEnd: (pos) => console.log(pos),
})

return <div {...dragHandleProps} style={{ ...dragHandleProps.style, transform: `translate(${position.x}px, ${position.y}px)` }} />
```

Controlled mode: pass `position` + `onPositionChange` instead of `defaultPosition`.

### Resize (8 handles)

```tsx
import { Resizable } from 'clear-draggable'

<Resizable
  defaultSize={{ width: 220, height: 140 }}
  min={{ width: 80, height: 60 }}
  max={{ width: 480, height: 360 }}
  aspectRatio={2} // optional
  onResizeEnd={(size, position) => console.log(size, position)}
>
  <div>drag the handles</div>
</Resizable>
```

Handles: `n s e w ne nw se sw` (all rendered by default, `data-handle` attribute
on each). Dragging `n`/`w` moves the box origin so the dragged edge follows
the cursor — `position` is part of the resize state (`defaultPosition` /
`position` / `onPositionChange`).

### Sortable list

```tsx
import { SortableList } from 'clear-draggable'

const [items, setItems] = useState([{ id: 'a' }, { id: 'b' }])

<SortableList
  items={items}
  onReorder={setItems}
  renderItem={(item) => <div>{item.id}</div>}
  // Optional: tight ghost without list spacing (margins belong to the list,
  // not the floating card). Falls back to renderItem.
  renderGhost={(item) => <div>{item.id}</div>}
/>
```

The dragged item follows the cursor as a fixed overlay (whole-pixel positioned,
moved imperatively — no re-render per mousemove); the origin slot dims as a
placeholder. Items are measured via `fragment.getClientRects()`, no
`querySelector` needed.

### Kanban

```tsx
import { KanbanBoard } from 'clear-draggable'

const [cards, setCards] = useState([{ id: 'c1', columnId: 'todo' }])

<KanbanBoard
  columns={[{ id: 'todo', title: 'Todo' }, { id: 'done', title: 'Done' }]}
  cards={cards}
  onMove={(cardId, toColumnId, toIndex) => /* move card, lands at end */}
  renderCard={(card) => <div>{card.id}</div>}
/>
```

Drop target resolves via `document.elementFromPoint`, so it works with pointer
capture engaged. The hovered column highlights (`data-drop-target`), v0.1 drops
at the end of the column; dropping into the same column is a no-op.

### Dashboard grid (miro-like board)

```tsx
import { DashboardGrid } from 'clear-draggable'

const [widgets, setWidgets] = useState([{ id: 'w1', x: 8, y: 8, w: 180, h: 110 }])

<DashboardGrid
  widgets={widgets}
  onMove={(id, pos) => setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...pos } : w)))}
  cell={16} // snap step, 0 = off
  showGrid // draws the snap grid as board background
  renderWidget={(w) => <div>{w.id}</div>}
/>
```

## Robustness notes

- `setPointerCapture` is wrapped in `tryCapturePointer` (`src/lib/utils/pointer`):
  it throws `NotFoundError` for non-active pointers, so capture is always
  best-effort and never aborts a drag/resize. Capture is engaged after the
  drag state is set.
- Ghost overlays use `pointer-events: none` + whole-pixel transforms so 1px
  borders stay crisp.

## Sandbox

```bash
npm run dev      # http://localhost:5173
```

Five tabs, each a route (`clear-react-router`, history API): `/free`, `/resize`,
`/sortable`, `/kanban`, `/dashboard` (`/` and `*` redirect to `/free`).
Each tab demonstrates one primitive with live knobs (snap toggle, aspect
checkbox, order readout, drop highlight, grid background).

## Scripts

| Command           | What                         |
| ----------------- | ---------------------------- |
| `npm test`        | Vitest, 24 tests (jsdom)     |
| `npm run build`   | Sandbox → `dist` (Vercel)    |
| `npm run build:lib` | Library → `dist-lib` (es+cjs+dts) |
| `npm run dev`     | Sandbox dev server           |

`dist` / `dist-lib` are gitignored — remove after verification.

## Deploy to Vercel

Framework preset Vite, build `npm run build`, output `dist`. History-API
fallback is configured in `vercel.json` (rewrites → `/index.html`), so deep
links like `/kanban` survive refresh.

## Project layout

```
src/lib/            # the library, zero deps
  index.ts          # public API
  types.ts
  utils/geometry.ts # clamp/snap/reorder/resize math (pure, tested)
  utils/pointer.ts  # tryCapturePointer
  hooks/useDraggable.ts useResizable.ts
  components/Draggable.tsx Resizable.tsx SortableList.tsx KanbanBoard.tsx DashboardGrid.tsx
  __tests__/        # vitest suite
src/demo/           # sandbox (Tailwind, demo-only)
src/App.tsx         # routes via clear-react-router
vercel.json         # SPA fallback
```

## Roadmap

- Spring-back drop physics for ghosts
- Dashboard widgets as drag + resize combined, collisions, `localStorage` persistence
- Keyboard DnD (a11y), horizontal sortable, intra-column kanban positioning
- `<ViewTransition>` drop animations, lazy route splitting in the sandbox
