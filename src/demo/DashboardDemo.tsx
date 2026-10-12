import { useState } from 'react'
import { DashboardGrid } from '../lib'
import type { DashboardWidget } from '../lib'
import type { Position } from '../lib'

const CELL = 16

const initial: DashboardWidget[] = [
  { id: 'w1', x: 8, y: 8, w: 180, h: 110 },
  { id: 'w2', x: 200, y: 40, w: 180, h: 110 },
  { id: 'w3', x: 80, y: 180, w: 220, h: 120 },
]

const colors: Record<string, string> = {
  w1: 'bg-indigo-500',
  w2: 'bg-emerald-500',
  w3: 'bg-amber-500',
}

export function DashboardDemo() {
  const [widgets, setWidgets] = useState(initial)
  const [snap, setSnap] = useState(true)

  const handleMove = (id: string, pos: Position) =>
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...pos } : w)))

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-sm text-gray-500">
        <span>Miro-like dashboard builder: widgets live on a {CELL}px grid.</span>
        <label className="flex items-center gap-2 text-gray-700">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          snap
        </label>
      </div>
      <DashboardGrid
        widgets={widgets}
        onMove={handleMove}
        cell={snap ? CELL : 0}
        showGrid={snap}
        className="rounded-lg border border-gray-200 bg-gray-50"
        renderWidget={(w) => (
          <div className={`flex h-full w-full items-center justify-center rounded-lg text-white shadow ${colors[w.id]}`}>
            {w.id} · {w.x},{w.y} · {w.w}×{w.h}
          </div>
        )}
      />
    </div>
  )
}
