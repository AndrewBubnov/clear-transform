import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DashboardGrid } from '../components/DashboardGrid'
import type { DashboardWidget } from '../components/DashboardGrid'
import type { Position } from '../types'

const initial: DashboardWidget[] = [
  { id: 'w1', x: 8, y: 8, w: 100, h: 60 },
  { id: 'w2', x: 200, y: 40, w: 100, h: 60 },
]

function Board({ cell = 16, showGrid = false }: { cell?: number; showGrid?: boolean }) {
  const [widgets, setWidgets] = useState(initial)
  const handleMove = (id: string, pos: Position) =>
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...pos } : w)))
  return (
    <DashboardGrid
      widgets={widgets}
      onMove={handleMove}
      cell={cell}
      showGrid={showGrid}
      renderWidget={(w) => <span>{w.id}</span>}
    />
  )
}

describe('DashboardGrid', () => {
  it('renders widgets at their positions', () => {
    render(<Board />)
    const w1 = screen.getByText('w1').parentElement!
    expect(w1.style.left).toBe('8px')
    expect(w1.style.top).toBe('8px')
  })

  it('draws the snap grid background when showGrid is on', () => {
    render(<Board showGrid />)
    const board = screen.getByText('w1').parentElement!.parentElement!
    expect(board.style.backgroundImage).toContain('linear-gradient')
    expect(board.style.backgroundSize).toBe('16px 16px')
  })

  it('drags a widget with snap-to-grid', () => {
    render(<Board />)
    const w1 = screen.getByText('w1').parentElement!
    const board = w1.parentElement!
    // jsdom has no layout (rects are zero), so the grab offset is the raw point.
    // Grab at (10, 10), drop at a non-grid point (103, 77).
    fireEvent.pointerDown(w1, { clientX: 10, clientY: 10, button: 0 })
    fireEvent.pointerMove(board, { clientX: 103, clientY: 77 })
    fireEvent.pointerUp(board)
    // Raw (93, 67) snaps to (96, 64).
    expect(w1.style.left).toBe('96px')
    expect(w1.style.top).toBe('64px')
  })

  it('cell 0 disables snapping', () => {
    render(<Board cell={0} />)
    const w1 = screen.getByText('w1').parentElement!
    const board = w1.parentElement!
    fireEvent.pointerDown(w1, { clientX: 10, clientY: 10, button: 0 })
    fireEvent.pointerMove(board, { clientX: 103, clientY: 77 })
    fireEvent.pointerUp(board)
    expect(w1.style.left).toBe('93px')
    expect(w1.style.top).toBe('67px')
  })
})
