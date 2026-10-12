import type { Bounds, Position, ResizeHandle, Size } from '../types'

export function clamp(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min
  if (max !== undefined && value > max) return max
  return value
}

export function clampPosition(pos: Position, bounds?: Bounds): Position {
  if (!bounds) return pos
  return {
    x: clamp(pos.x, bounds.minX, bounds.maxX),
    y: clamp(pos.y, bounds.minY, bounds.maxY),
  }
}

export function clampSize(
  size: Size,
  min?: Partial<Size>,
  max?: Partial<Size>,
): Size {
  return {
    width: clamp(size.width, min?.width, max?.width),
    height: clamp(size.height, min?.height, max?.height),
  }
}

export function snapToGrid(value: number, cell: number): number {
  if (!cell || cell <= 0) return value
  return Math.round(value / cell) * cell
}

/** Move an item inside an array — the base for sortable/kanban */
export function moveItemInArray<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = [...arr]
  if (from < 0 || from >= next.length) return next
  const clampedTo = clamp(to, 0, next.length - 1)
  const [item] = next.splice(from, 1)
  next.splice(clampedTo, 0, item)
  return next
}

/**
 * Given a mouse Y coordinate and a list of rects, find the drop gap.
 * Returns an insertion index in 0..rects.length.
 */
export function getInsertionIndex(
  mouseY: number,
  rects: Array<{ top: number; height: number }>,
): number {
  for (let i = 0; i < rects.length; i++) {
    const middle = rects[i].top + rects[i].height / 2
    if (mouseY < middle) return i
  }
  return rects.length
}

export interface ResizeInput {
  startSize: Size
  startMouse: Position
  currentMouse: Position
  handle: ResizeHandle
  min?: Partial<Size>
  max?: Partial<Size>
  aspectRatio?: number
}

/**
 * Pure resize math: compute the new size from the mouse delta plus
 * the position shift (for N/W handles the element grows left/up).
 */
export function resizeWithHandle(input: ResizeInput): { size: Size; dx: number; dy: number } {
  const { startSize, startMouse, currentMouse, handle, min, max, aspectRatio } = input
  const deltaX = currentMouse.x - startMouse.x
  const deltaY = currentMouse.y - startMouse.y

  let width = startSize.width
  let height = startSize.height
  let dx = 0
  let dy = 0

  if (handle.includes('e')) width = startSize.width + deltaX
  if (handle.includes('s')) height = startSize.height + deltaY
  if (handle.includes('w')) {
    width = startSize.width - deltaX
    dx = deltaX
  }
  if (handle.includes('n')) {
    height = startSize.height - deltaY
    dy = deltaY
  }

  // aspectRatio: the leading edge is the one that changed the most
  if (aspectRatio && aspectRatio > 0) {
    const dw = Math.abs(width - startSize.width)
    const dh = Math.abs(height - startSize.height)
    if (dw >= dh) {
      height = width / aspectRatio
    } else {
      width = height * aspectRatio
    }
  }

  const clamped = clampSize({ width, height }, min, max)

  // If clamp trimmed the size for w/n handles, adjust the shift
  // so the edge that is not dragged stays in place.
  if (handle.includes('w')) dx = startSize.width - clamped.width
  else dx = 0
  if (handle.includes('n')) dy = startSize.height - clamped.height
  else dy = 0

  return { size: clamped, dx, dy }
}
