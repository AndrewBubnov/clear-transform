import { useState } from 'react'
import { KanbanBoard } from '../lib'
import type { KanbanCard } from '../lib'

const columns = [
  { id: 'todo', title: 'Todo' },
  { id: 'doing', title: 'In progress' },
  { id: 'done', title: 'Done' },
]

const initial: (KanbanCard & { title: string })[] = [
  { id: 'c1', columnId: 'todo', title: 'Types and geometry' },
  { id: 'c2', columnId: 'todo', title: 'Drag/resize hooks' },
  { id: 'c3', columnId: 'doing', title: 'Sandbox' },
  { id: 'c4', columnId: 'done', title: 'Vite skeleton' },
]

export function KanbanDemo() {
  const [cards, setCards] = useState(initial)
  return (
    <KanbanBoard
      columns={columns}
      cards={cards}
      onMove={(cardId, toColumnId) =>
        setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c)))
      }
      renderCard={(card) => (
        <div className="rounded-lg bg-white px-3 py-2 text-sm shadow">
          {(card as { title: string }).title}
        </div>
      )}
    />
  )
}
