import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from 'react'
import { clampPosition, snapToGrid } from '../utils/geometry'
import { tryCapturePointer } from '../utils/pointer'
import type { Bounds, Position } from '../types'

export interface UseDraggableOptions {
  defaultPosition?: Position
  /** Controlled mode */
  position?: Position
  onPositionChange?: (pos: Position) => void
  onDragStart?: (pos: Position) => void
  onDragEnd?: (pos: Position) => void
  disabled?: boolean
  bounds?: Bounds
  /** Snap step in px, 0 = off */
  grid?: number
}

/**
 * Pointer-based dragging. Works with mouse and touch.
 * Returns a ref for the DOM node (React 19: ref as prop).
 */
export function useDraggable(options: UseDraggableOptions = {}) {
  const {
    defaultPosition = { x: 0, y: 0 },
    position: controlled,
    onPositionChange,
    onDragStart,
    onDragEnd,
    disabled = false,
    bounds,
    grid = 0,
  } = options

  const [uncontrolled, setUncontrolled] = useState<Position>(defaultPosition)
  const [isDragging, setIsDragging] = useState(false)
  const ref = useRef<HTMLElement | null>(null)
  const dragRef = useRef<{ startMouse: Position; startPos: Position } | null>(null)

  const position = controlled ?? uncontrolled

  const setPosition = useCallback(
    (pos: Position) => {
      let next = clampPosition(pos, bounds)
      if (grid > 0) {
        next = { x: snapToGrid(next.x, grid), y: snapToGrid(next.y, grid) }
      }
      if (controlled === undefined) setUncontrolled(next)
      onPositionChange?.(next)
    },
    [bounds, grid, controlled, onPositionChange],
  )

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (disabled) return
      if (e.button !== undefined && e.button !== 0) return
      const el = ref.current
      if (!el) return
      dragRef.current = {
        startMouse: { x: e.clientX, y: e.clientY },
        startPos: controlled ?? uncontrolled,
      }
      setIsDragging(true)
      onDragStart?.(controlled ?? uncontrolled)
      // Capture last: a throwing capture must not abort the drag.
      tryCapturePointer(el, e.pointerId)
      e.preventDefault()
    },
    [disabled, controlled, uncontrolled, onDragStart],
  )

  useEffect(() => {
    const el = ref.current
    if (!el || disabled) return

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      setPosition({
        x: drag.startPos.x + (e.clientX - drag.startMouse.x),
        y: drag.startPos.y + (e.clientY - drag.startMouse.y),
      })
    }
    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      setIsDragging(false)
      onDragEnd?.(controlled ?? uncontrolled)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [disabled, setPosition, controlled, uncontrolled, onDragEnd])

  // Ready-to-spread visual style: everything the drag owns.
  // Absolute by default so translate() maps to the (relative) container
  // origin. In-flow translated boxes keep their layout footprint (visual
  // overflow grows a page scrollbar) and slide under positioned siblings,
  // losing pointer events — free drag needs out-of-flow.
  // Spread it first, your style after (don't override `transform`,
  // it carries the position).
  const dragStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    touchAction: 'none',
    cursor: disabled ? undefined : isDragging ? 'grabbing' : 'grab',
    transform: `translate(${position.x}px, ${position.y}px)`,
    userSelect: 'none',
  }

  const dragHandleProps = {
    ref: ref as Ref<HTMLElement>,
    onPointerDown: handlePointerDown,
    'aria-grabbed': isDragging,
  }

  return { ref, position, isDragging, dragHandleProps, dragStyle, setPosition }
}
