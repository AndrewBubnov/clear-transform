import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SortableList } from '../components/SortableList'

function Interactive() {
  const [items, setItems] = useState([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  return (
    <>
      <div data-testid="order">{items.map((i) => i.id).join(',')}</div>
      <SortableList items={items} onReorder={setItems} renderItem={(item) => <span>{item.id}</span>} />
    </>
  )
}

describe('SortableList', () => {
  it('renders all items', () => {
    render(<Interactive />)
    expect(screen.getByTestId('order').textContent).toBe('a,b,c')
    expect(screen.getByText('a').textContent).toBe('a')
  })

  it('shows a ghost that follows the cursor and unmounts on drop', () => {
    render(<Interactive />)
    const list = screen.getByRole('list')
    const first = screen.getByText('a').closest('[data-sortable-id]') as HTMLElement

    expect(document.querySelector('[data-sortable-ghost]')).toBeNull()

    fireEvent.pointerDown(first, { clientX: 10, clientY: 20, button: 0 })
    const ghost = document.querySelector('[data-sortable-ghost]') as HTMLElement
    expect(ghost).not.toBeNull()
    expect(ghost.getAttribute('data-sortable-ghost')).toBe('a')
    // Origin slot dims as a placeholder.
    expect(first.style.opacity).toBe('0.35')

    fireEvent.pointerMove(list, { clientX: 30, clientY: 80 })
    expect(ghost.style.transform).toBe('translate(20px, 60px)')

    fireEvent.pointerUp(list)
    expect(document.querySelector('[data-sortable-ghost]')).toBeNull()
  })

  it('prefers renderGhost for the overlay when provided', () => {
    render(
      <SortableList
        items={[{ id: 'a' }, { id: 'b' }]}
        onReorder={() => {}}
        renderItem={(item) => <span>item-{item.id}</span>}
        renderGhost={(item) => <span>ghost-{item.id}</span>}
      />,
    )
    const first = screen.getByText('item-a').closest('[data-sortable-id]') as HTMLElement
    fireEvent.pointerDown(first, { clientX: 10, clientY: 20, button: 0 })
    const ghost = document.querySelector('[data-sortable-ghost]') as HTMLElement
    expect(ghost.textContent).toBe('ghost-a')
  })
})
