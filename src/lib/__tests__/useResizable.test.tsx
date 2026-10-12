import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Resizable } from '../components/Resizable'

describe('Resizable', () => {
  it('renders 8 handles and resizes via SE', () => {
    render(
      <Resizable defaultSize={{ width: 100, height: 80 }}>
        <span>content</span>
      </Resizable>,
    )
    const handles = document.querySelectorAll('[data-handle]')
    expect(handles).toHaveLength(8)

    const box = screen.getByText('content').parentElement!
    expect(box.style.width).toBe('100px')

    const se = document.querySelector('[data-handle="se"]') as HTMLElement
    fireEvent.pointerDown(se, { clientX: 0, clientY: 0, button: 0 })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 20 })
    fireEvent.pointerUp(window)

    expect(box.style.width).toBe('130px')
    expect(box.style.height).toBe('100px')
  })

  it('min constrains the size', () => {
    render(
      <Resizable defaultSize={{ width: 100, height: 100 }} min={{ width: 80, height: 80 }}>
        <span>small</span>
      </Resizable>,
    )
    const box = screen.getByText('small').parentElement!
    const nw = document.querySelector('[data-handle="nw"]') as HTMLElement
    fireEvent.pointerDown(nw, { clientX: 0, clientY: 0, button: 0 })
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 })
    fireEvent.pointerUp(window)
    expect(box.style.width).toBe('80px')
  })

  it('N handle moves the top edge, the bottom one stays', () => {
    render(
      <Resizable defaultSize={{ width: 200, height: 100 }}>
        <span>tall</span>
      </Resizable>,
    )
    const box = screen.getByText('tall').parentElement!
    const n = document.querySelector('[data-handle="n"]') as HTMLElement
    fireEvent.pointerDown(n, { clientX: 0, clientY: 0, button: 0 })
    fireEvent.pointerMove(window, { clientX: 0, clientY: 30 })
    fireEvent.pointerUp(window)
    // Height shrinks by 30 AND the box shifts down by 30,
    // so the bottom edge stays where it was.
    expect(box.style.height).toBe('70px')
    expect(box.style.transform).toBe('translate(0px, 30px)')
  })
})
