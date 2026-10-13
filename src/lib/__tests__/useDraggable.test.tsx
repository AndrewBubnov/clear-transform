import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Draggable } from '../components/Draggable'

describe('Draggable', () => {
  it('renders and moves position after drag', () => {
    const onDragEnd = vi.fn()
    render(
      <Draggable onDragEnd={onDragEnd}>
        <span>box</span>
      </Draggable>,
    )
    const box = screen.getByText('box').parentElement!
    expect(box.style.transform).toBe('translate(0px, 0px)')
    // Out-of-flow by default: translate() maps to the container origin,
    // in-flow boxes would grow a page scrollbar and slide under siblings.
    expect(box.style.position).toBe('absolute')

    fireEvent.pointerDown(box, { clientX: 10, clientY: 10, button: 0 })
    fireEvent.pointerMove(box, { clientX: 60, clientY: 40 })
    fireEvent.pointerUp(box)

    expect(box.style.transform).toBe('translate(50px, 30px)')
    expect(onDragEnd).toHaveBeenCalled()
  })

  it('disabled blocks movement', () => {
    render(
      <Draggable disabled defaultPosition={{ x: 5, y: 5 }}>
        <span>locked</span>
      </Draggable>,
    )
    const box = screen.getByText('locked').parentElement!
    fireEvent.pointerDown(box, { clientX: 0, clientY: 0, button: 0 })
    fireEvent.pointerMove(box, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(box)
    expect(box.style.transform).toBe('translate(5px, 5px)')
  })
})
