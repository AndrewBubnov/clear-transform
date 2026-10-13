# clear-transform — agent guidelines

## Code style
- All code comments, JSDoc, and demo UI copy in English only.
- Named imports from 'react' only — never `React.useRef`, `React.PointerEvent`, etc.
  Type-only imports via `import type { ... } from 'react'`.
  For React synthetic events use `import type { PointerEvent as ReactPointerEvent } from 'react'`
  (the bare `PointerEvent` name is the DOM one).
- TypeScript strict, `react-jsx`, path alias: library code lives in `src/lib`.

## Library (`src/lib`)
- Zero runtime dependencies. `peerDependencies: react ^19.3, react-dom ^19.3`.
- NOTE: `clear-react-router` sits in `dependencies` for the sandbox only —
  move it to `devDependencies` before publishing the lib to npm.
- Baseline is React 19.3: use `ref as prop`, no `forwardRef`.
- Group wrappers use `<Fragment ref>` (FragmentInstance: `getClientRects`,
  `observeUsing`, `addEventListener`). Per-item transforms go on real DOM nodes —
  FragmentInstance has no `style`.
- Pull the react-dom augmentation with `import type {} from 'react-dom'`
  wherever `FragmentInstance` methods are used (see `src/lib/types.ts`).
- Styling: inline styles only, no Tailwind in lib. Resize handles use `data-handle`.
- Never call `setPointerCapture` directly — use `tryCapturePointer` from
  `src/lib/utils/pointer` (it throws `NotFoundError` for non-active pointers)
  and always call it after the drag/resize state is set.

## Sandbox (`src/demo`, `src/App.tsx`)
- Tailwind CSS v4 (`@import "tailwindcss"`) is demo-only.
- Demo imports lib via `../lib` (source, not dist).
- Tabs are routes via `clear-react-router` (history API): `/free`, `/resize`,
  `/sortable`, `/kanban`, `/dashboard`; `/` and `*` redirect to `/free`.
  Nav uses `<Link>` with active-state className fn; header/nav stay static
  outside `<Router>`. SPA fallback lives in `vercel.json` rewrites.

## Tests
- Vitest + jsdom + Testing Library. Test files in `src/lib/__tests__/`.
- Fire pointer interactions with `fireEvent.pointerDown/Move/Up`
  (raw `dispatchEvent` bypasses React synthetic handlers).
- Test descriptions in English.

## Verification
- `npm test` (28 tests green), `npm run build` (demo → `dist`, Vercel-ready),
  `npm run build:lib` (es+cjs+dts → `dist-lib`).
- CI (`.github/workflows/ci.yml`) runs `npm ci` + test + both builds
  on every push/PR (Node 22, ubuntu).
- Windows caveat: never run `npm ci` while the dev server is up — the Vite
  native binding stays file-locked and `node_modules` ends up half-deleted.
  Stop dev first, then reinstall.
- Remove `dist`/`dist-lib` after verification (both gitignored).
- Git is handled by the user — never commit/push.
