import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SortableList } from '../components/SortableList'

// jsdom has no layout (all rects are zero), so stub per-item geometry.
// Items a/b/c stacked 50px tall starting at top 0.
const LAYOUT: Record<string, number> = { a: 0, b: 50, c: 100 }
const ITEM_H = 50

let restoreLayout: (() => void) | undefined

beforeEach(() => {
  const orig = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const id = this.closest?.('[data-sortable-id]')?.getAttribute('data-sortable-id')
    if (id !== null && id !== undefined && id in LAYOUT) {
      const top = LAYOUT[id]
      return {
        top,
        height: ITEM_H,
        left: 0,
        width: 200,
        bottom: top + ITEM_H,
        right: 200,
        x: 0,
        y: top,
        toJSON: () => {},
      } as DOMRect
    }
    return orig.call(this)
  } as typeof Element.prototype.getBoundingClientRect
  restoreLayout = () => {
    Element.prototype.getBoundingClientRect = orig
  }
})

afterEach(() => {
  restoreLayout?.()
  restoreLayout = undefined
})

function Interactive() {
  const [items, setItems] = useState([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  return (
    <>
      <div data-testid="order">{items.map((i) => i.id).join(',')}</div>
      <SortableList items={items} onReorder={setItems} renderItem={(item) => <span>{item.id}</span>} />
    </>
  )
}

function SpyBoard({ onMove }: { onMove: (items: Array<{ id: string }>) => void }) {
  const [items, setItems] = useState([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  return (
    <>
      <div data-testid="order">{items.map((i) => i.id).join(',')}</div>
      <SortableList
        items={items}
        onReorder={(next) => {
          onMove(next)
          setItems(next)
        }}
        renderItem={(item) => <span>{item.id}</span>}
      />
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

    fireEvent.pointerMove(list, { clientX: 30, clientY: 80 })
    expect(ghost.style.transform).toBe('translate(20px, 60px)')

    fireEvent.pointerUp(list)
    expect(document.querySelector('[data-sortable-ghost]')).toBeNull()
  })

  it('opens a gap at the drop position and commits reorder on drop', () => {
    render(<Interactive />)
    const list = screen.getByRole('list')
    const second = screen.getByText('b').closest('[data-sortable-id]') as HTMLElement

    expect(document.querySelector('[data-sortable-gap]')).toBeNull()

    // Grab b (spans 50-100) and move above a (middle 25).
    fireEvent.pointerDown(second, { clientX: 10, clientY: 60, button: 0 })
    fireEvent.pointerMove(list, { clientX: 10, clientY: 10 })

    // Gap opens before the first item with the dragged height;
    // the dragged origin collapses so the rest close ranks,
    // and the list itself stays put until drop.
    const gap = document.querySelector('[data-sortable-gap]') as HTMLElement
    expect(gap).not.toBeNull()
    expect(gap.style.height).toBe('50px')
    expect(document.querySelectorAll('[data-sortable-id]')).toHaveLength(2)
    expect(screen.getByTestId('order').textContent).toBe('a,b,c')

    fireEvent.pointerUp(list, { clientX: 10, clientY: 10 })
    expect(screen.getByTestId('order').textContent).toBe('b,a,c')
    expect(document.querySelector('[data-sortable-gap]')).toBeNull()
    expect(document.querySelector('[data-sortable-ghost]')).toBeNull()
  })

  it('shows the home gap at the origin slot but commits nothing on drop', () => {
    const onMove = vi.fn()
    render(<SpyBoard onMove={onMove} />)
    const list = screen.getByRole('list')
    const first = screen.getByText('a').closest('[data-sortable-id]') as HTMLElement

    // Hold a over its own slot (y=10, above b-middle in collapsed coords):
    // the home gap marks the landing, dropping is a no-op so onReorder
    // must not fire at all.
    fireEvent.pointerDown(first, { clientX: 10, clientY: 10, button: 0 })
    fireEvent.pointerMove(list, { clientX: 10, clientY: 10 })

    expect(document.querySelector('[data-sortable-gap]')).not.toBeNull()

    fireEvent.pointerUp(list, { clientX: 10, clientY: 10 })
    expect(onMove).not.toHaveBeenCalled()
    expect(screen.getByTestId('order').textContent).toBe('a,b,c')
  })

  it('commits the drop on pointerup outside the list (window backup)', () => {
    render(<Interactive />)
    const list = screen.getByRole('list')
    const second = screen.getByText('b').closest('[data-sortable-id]') as HTMLElement

    fireEvent.pointerDown(second, { clientX: 10, clientY: 60, button: 0 })
    fireEvent.pointerMove(list, { clientX: 10, clientY: 10 })
    expect(document.querySelector('[data-sortable-gap]')).not.toBeNull()

    // Release outside the list: the container never sees it,
    // the window-level backup commits the visible gap position.
    fireEvent.pointerUp(window, { clientX: 10, clientY: 10 })
    expect(screen.getByTestId('order').textContent).toBe('b,a,c')
    expect(document.querySelector('[data-sortable-ghost]')).toBeNull()
  })

  // jsdom has no Element.animate: stub it to test the drop fly-in path.
  function mockAnimate() {
    const resolvers: Array<() => void> = []
    const effects: Array<{ keyframes: unknown; options: unknown }> = []
    const orig = (Element.prototype as unknown as { animate?: unknown }).animate
    ;(Element.prototype as unknown as { animate: unknown }).animate = function (
      this: unknown,
      keyframes: unknown,
      options: unknown,
    ) {
      let resolve!: () => void
      const finished = new Promise<void>((res) => {
        resolve = res
      })
      resolvers.push(resolve)
      effects.push({ keyframes, options })
      return { finished, cancel: () => {} }
    }
    return {
      resolvers,
      effects,
      restore: () => {
        if (orig === undefined) delete (Element.prototype as unknown as { animate?: unknown }).animate
        else (Element.prototype as unknown as { animate: unknown }).animate = orig
      },
    }
  }

  it('flies the ghost into the gap and commits on landing', async () => {
    const flight = mockAnimate()
    try {
      render(<Interactive />)
      const list = screen.getByRole('list')
      const second = screen.getByText('b').closest('[data-sortable-id]') as HTMLElement

      fireEvent.pointerDown(second, { clientX: 10, clientY: 60, button: 0 })
      fireEvent.pointerMove(list, { clientX: 10, clientY: 10 })
      fireEvent.pointerUp(list, { clientX: 10, clientY: 10 })

      // Commit deferred until landing: order unchanged, ghost still flying.
      // The end frame is pinned (fill:forwards) so the ghost can't snap
      // back to its inline transform in the frames before unmount.
      expect(screen.getByTestId('order').textContent).toBe('a,b,c')
      expect(flight.resolvers).toHaveLength(1)
      expect(flight.effects).toHaveLength(1)
      expect(flight.effects[0].options).toMatchObject({ fill: 'forwards' })
      expect(document.querySelector('[data-sortable-ghost]')).not.toBeNull()

      await act(async () => {
        flight.resolvers[0]()
      })
      expect(screen.getByTestId('order').textContent).toBe('b,a,c')
      expect(document.querySelector('[data-sortable-ghost]')).toBeNull()
    } finally {
      flight.restore()
    }
  })

  it('abandons the drop flight when a new drag starts', async () => {
    const flight = mockAnimate()
    try {
      render(<Interactive />)
      const list = screen.getByRole('list')
      const second = screen.getByText('b').closest('[data-sortable-id]') as HTMLElement

      fireEvent.pointerDown(second, { clientX: 10, clientY: 60, button: 0 })
      fireEvent.pointerMove(list, { clientX: 10, clientY: 10 })
      fireEvent.pointerUp(list, { clientX: 10, clientY: 10 })
      expect(flight.resolvers).toHaveLength(1)

      // Grab another item mid-flight: the pending commit is abandoned.
      const third = screen.getByText('c').closest('[data-sortable-id]') as HTMLElement
      fireEvent.pointerDown(third, { clientX: 10, clientY: 110, button: 0 })
      await act(async () => {
        flight.resolvers[0]()
      })
      expect(screen.getByTestId('order').textContent).toBe('a,b,c')

      // Cleanup the second drag (no-op drop at its own area).
      fireEvent.pointerUp(list, { clientX: 10, clientY: 110 })
      expect(document.querySelector('[data-sortable-ghost]')).toBeNull()
    } finally {
      flight.restore()
    }
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
    // Cleanup: finish the drag so window listeners don't leak.
    fireEvent.pointerUp(first, { clientX: 10, clientY: 20 })
  })
})
