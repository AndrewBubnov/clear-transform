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

function handlePosition(handle: ResizeHandle): CSSProperties {
  const base: CSSProperties = { position: 'absolute', zIndex: 10 }
  const offset = -6
  const size = 12
  const center = `calc(50% - ${size / 2}px)`
  switch (handle) {
    case 'n': return { ...base, top: offset, left: center, width: size, height: size, cursor: HANDLE_CURSORS.n }
    case 's': return { ...base, bottom: offset, left: center, width: size, height: size, cursor: HANDLE_CURSORS.s }
    case 'e': return { ...base, right: offset, top: center, width: size, height: size, cursor: HANDLE_CURSORS.e }
    case 'w': return { ...base, left: offset, top: center, width: size, height: size, cursor: HANDLE_CURSORS.w }
    case 'ne': return { ...base, top: offset, right: offset, width: size, height: size, cursor: HANDLE_CURSORS.ne }
    case 'nw': return { ...base, top: offset, left: offset, width: size, height: size, cursor: HANDLE_CURSORS.nw }
    case 'se': return { ...base, bottom: offset, right: offset, width: size, height: size, cursor: HANDLE_CURSORS.se }
    case 'sw': return { ...base, bottom: offset, left: offset, width: size, height: size, cursor: HANDLE_CURSORS.sw }
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

  const resizeHandleProps = (handle: ResizeHandle) => ({
    'data-handle': handle,
    onPointerDown: startResize(handle),
    style: {
      ...handlePosition(handle),
      touchAction: 'none',
      background: '#fff',
      border: '1px solid #6366f1',
      borderRadius: 3,
    } as CSSProperties,
    'aria-label': `resize-${handle}`,
  })

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
