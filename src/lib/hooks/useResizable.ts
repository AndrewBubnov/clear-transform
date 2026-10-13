import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from 'react'
import { resizeWithHandle } from '../utils/geometry'
import { tryCapturePointer } from '../utils/pointer'
import { ALL_HANDLES } from '../types'
import type { Position, ResizeHandle, Size } from '../types'

export interface UseResizableOptions {
  defaultSize?: Size
  size?: Size
  onSizeChange?: (size: Size) => void
  /**
   * Box origin offset. N/W handles move the box as they resize,
   * so the position is part of the resize state.
   */
  defaultPosition?: Position
  position?: Position
  onPositionChange?: (pos: Position) => void
  min?: Partial<Size>
  max?: Partial<Size>
  aspectRatio?: number
  disabled?: boolean
  onResizeStart?: (handle: ResizeHandle) => void
  onResizeEnd?: (size: Size, position: Position) => void
}

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
}

const HANDLE_COLOR = '#6366f1'

/**
 * Invisible hit areas: edge strips span the full side *inside* the box,
 * corners are small squares inside the corners. Inset strips keep the 1px
 * hover line exactly on the box perimeter by construction (an inset shadow
 * always draws at the strip edge, so a straddling strip would offset the line).
 */
function handleGeometry(handle: ResizeHandle): CSSProperties {
  const base: CSSProperties = { position: 'absolute', zIndex: 10 }
  const edge = 8
  const corner = 12
  switch (handle) {
    case 'n': return { ...base, top: 0, left: 0, right: 0, height: edge }
    case 's': return { ...base, bottom: 0, left: 0, right: 0, height: edge }
    case 'e': return { ...base, top: 0, bottom: 0, right: 0, width: edge }
    case 'w': return { ...base, top: 0, bottom: 0, left: 0, width: edge }
    case 'ne': return { ...base, top: 0, right: 0, width: corner, height: corner }
    case 'nw': return { ...base, top: 0, left: 0, width: corner, height: corner }
    case 'se': return { ...base, bottom: 0, right: 0, width: corner, height: corner }
    case 'sw': return { ...base, bottom: 0, left: 0, width: corner, height: corner }
  }
}

/** 1px line exactly on the box perimeter for the hovered/active handle. */
function handleLine(handle: ResizeHandle): string {
  const c = HANDLE_COLOR
  switch (handle) {
    case 'n': return `inset 0 1px 0 0 ${c}`
    case 's': return `inset 0 -1px 0 0 ${c}`
    case 'e': return `inset -1px 0 0 0 ${c}`
    case 'w': return `inset 1px 0 0 0 ${c}`
    case 'ne': return `inset -1px 0 0 0 ${c}, inset 0 1px 0 0 ${c}`
    case 'nw': return `inset 1px 0 0 0 ${c}, inset 0 1px 0 0 ${c}`
    case 'se': return `inset -1px 0 0 0 ${c}, inset 0 -1px 0 0 ${c}`
    case 'sw': return `inset 1px 0 0 0 ${c}, inset 0 -1px 0 0 ${c}`
  }
}

export function useResizable(options: UseResizableOptions = {}) {
  const {
    defaultSize = { width: 200, height: 150 },
    size: controlled,
    onSizeChange,
    defaultPosition = { x: 0, y: 0 },
    position: controlledPosition,
    onPositionChange,
    min,
    max,
    aspectRatio,
    disabled = false,
    onResizeStart,
    onResizeEnd,
  } = options

  const [uncontrolled, setUncontrolled] = useState<Size>(defaultSize)
  const [uncontrolledPosition, setUncontrolledPosition] = useState<Position>(defaultPosition)
  const [isResizing, setIsResizing] = useState(false)
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null)
  // :hover can't be expressed with inline styles — track it in state.
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null)
  const ref = useRef<HTMLElement | null>(null)
  const resizeRef = useRef<{
    handle: ResizeHandle
    startMouse: Position
    startSize: Size
    startPos: Position
  } | null>(null)

  const size = controlled ?? uncontrolled
  const position = controlledPosition ?? uncontrolledPosition

  // Live mirrors so window listeners and onResizeEnd never read stale closures.
  const sizeRef = useRef(size)
  sizeRef.current = size
  const positionRef = useRef(position)
  positionRef.current = position

  const applySize = useCallback(
    (next: Size) => {
      if (controlled === undefined) setUncontrolled(next)
      onSizeChange?.(next)
    },
    [controlled, onSizeChange],
  )

  const applyPosition = useCallback(
    (next: Position) => {
      if (controlledPosition === undefined) setUncontrolledPosition(next)
      onPositionChange?.(next)
    },
    [controlledPosition, onPositionChange],
  )

  const startResize = useCallback(
    (handle: ResizeHandle) => (e: ReactPointerEvent) => {
      if (disabled) return
      if (e.button !== undefined && e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      resizeRef.current = {
        handle,
        startMouse: { x: e.clientX, y: e.clientY },
        startSize: controlled ?? uncontrolled,
        startPos: controlledPosition ?? uncontrolledPosition,
      }
      setIsResizing(true)
      setActiveHandle(handle)
      onResizeStart?.(handle)
      // Capture last: a throwing capture must not abort the resize.
      tryCapturePointer(e.target, e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const r = resizeRef.current
        if (!r) return
        const { size: next, dx, dy } = resizeWithHandle({
          startSize: r.startSize,
          startMouse: r.startMouse,
          currentMouse: { x: ev.clientX, y: ev.clientY },
          handle: r.handle,
          min,
          max,
          aspectRatio,
        })
        applySize(next)
        // N/W handles shift the box origin so the dragged edge follows the cursor.
        applyPosition({ x: r.startPos.x + dx, y: r.startPos.y + dy })
      }
      const onUp = () => {
        resizeRef.current = null
        setIsResizing(false)
        setActiveHandle(null)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        onResizeEnd?.(sizeRef.current, positionRef.current)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [disabled, controlled, uncontrolled, controlledPosition, uncontrolledPosition, min, max, aspectRatio, applySize, applyPosition, onResizeStart, onResizeEnd],
  )

  const resizeHandleProps = (handle: ResizeHandle) => {
    const highlighted = hoveredHandle === handle || activeHandle === handle
    return {
      'data-handle': handle,
      onPointerDown: startResize(handle),
      onPointerEnter: () => setHoveredHandle(handle),
      onPointerLeave: () => setHoveredHandle((prev) => (prev === handle ? null : prev)),
      style: {
        ...handleGeometry(handle),
        cursor: HANDLE_CURSORS[handle],
        touchAction: 'none',
        background: 'transparent',
        // Idle: a plain div, nothing visible. Hover/active: 1px edge line.
        boxShadow: highlighted ? handleLine(handle) : 'none',
      } as CSSProperties,
      'aria-label': `resize-${handle}`,
    }
  }

  return {
    ref: ref as Ref<HTMLElement>,
    size,
    position,
    isResizing,
    activeHandle,
    handles: ALL_HANDLES,
    resizeHandleProps,
    setSize: applySize,
    setPosition: applyPosition,
  }
}
