import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KanbanBoard } from '../components/KanbanBoard'
import type { KanbanCard } from '../components/KanbanBoard'
type Card = KanbanCard & { title: string }

const columns = [
  { id: 'todo', title: 'Todo' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' },
]

const initial: Card[] = [
  { id: 'c1', columnId: 'todo', title: 'First' },
  { id: 'c2', columnId: 'todo', title: 'Second' },
  { id: 'c3', columnId: 'doing', title: 'Third' },
]

function Board({ onMove }: { onMove: (cardId: string, col: string, index: number) => void }) {
  const [cards, setCards] = useState(initial)
  return (
    <KanbanBoard
      columns={columns}
      cards={cards}
      onMove={(cardId, toColumnId, toIndex) => {
        onMove(cardId, toColumnId, toIndex)
        setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c)))
      }}
      renderCard={(card) => <span>{(card as Card).title}</span>}
    />
  )
}

const originalElementFromPoint = document.elementFromPoint

afterEach(() => {
  document.elementFromPoint = originalElementFromPoint
})

describe('KanbanBoard', () => {
  it('renders columns and cards', () => {
    render(<Board onMove={() => {}} />)
    expect(screen.getByText('Todo')).toBeTruthy()
    expect(screen.getByText('First')).toBeTruthy()
  })

  it('drags a card to another column via hit-testing, with ghost and highlight', () => {
    const onMove = vi.fn()
    render(<Board onMove={onMove} />)

    const doneCol = document.querySelector('[data-kanban-column="done"]') as HTMLElement
    // jsdom has no layout: stub hit-testing to resolve any point to the done column.
    document.elementFromPoint = (() => doneCol) as unknown as typeof document.elementFromPoint

    const card = screen.getByText('First').closest('[data-kanban-card]') as HTMLElement
    fireEvent.pointerDown(card, { clientX: 10, clientY: 20, button: 0 })

    const ghost = document.querySelector('[data-kanban-ghost]') as HTMLElement
    expect(ghost).not.toBeNull()
    expect(ghost.textContent).toBe('First')

    // Move anywhere: hit-test says "done", so it highlights.
    fireEvent.pointerMove(card, { clientX: 500, clientY: 200 })
    expect(doneCol.getAttribute('data-drop-target')).toBe('true')

    fireEvent.pointerUp(card, { clientX: 500, clientY: 200 })
    expect(onMove).toHaveBeenCalledWith('c1', 'done', 0)
    expect(document.querySelector('[data-kanban-ghost]')).toBeNull()
    expect(screen.getByText('Todo').parentElement?.textContent).not.toContain('First')
  })

  it('dropping back to the same column is a no-op', () => {
    const onMove = vi.fn()
    render(<Board onMove={onMove} />)
    const todoCol = document.querySelector('[data-kanban-column="todo"]') as HTMLElement
    document.elementFromPoint = (() => todoCol) as unknown as typeof document.elementFromPoint

    const card = screen.getByText('First').closest('[data-kanban-card]') as HTMLElement
    fireEvent.pointerDown(card, { clientX: 10, clientY: 20, button: 0 })
    fireEvent.pointerUp(card, { clientX: 10, clientY: 20 })
    expect(onMove).not.toHaveBeenCalled()
  })
})
