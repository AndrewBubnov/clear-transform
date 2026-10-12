import { useState } from 'react'
import { SortableList } from '../lib'

const initial = [
  { id: 'task-1', title: 'Write types' },
  { id: 'task-2', title: 'Build useDraggable' },
  { id: 'task-3', title: 'Build useResizable' },
  { id: 'task-4', title: 'Sandbox + Vercel' },
]

export function SortableDemo() {
  const [items, setItems] = useState(initial)
  return (
    <div className="max-w-md">
      <p className="mb-2 text-sm text-gray-500">Order: {items.map((i) => i.id).join(' → ')}</p>
      <SortableList
        items={items}
        onReorder={setItems}
        renderItem={(item) => (
          <div className="mb-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            {item.title}
          </div>
        )}
        // Tight ghost: no list spacing (mb-2) and no inline shadow —
        // the overlay adds the lift shadow itself.
        renderGhost={(item) => (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            {item.title}
          </div>
        )}
      />
    </div>
  )
}
