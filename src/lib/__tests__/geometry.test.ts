import { describe, expect, it } from 'vitest'
import {
  clamp,
  clampPosition,
  clampSize,
  getInsertionIndex,
  moveItemInArray,
  resizeWithHandle,
  snapToGrid,
} from '../utils/geometry'

describe('geometry', () => {
  it('clamp cuts values to range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
    expect(clamp(5)).toBe(5)
  })

  it('clampPosition respects bounds', () => {
    expect(clampPosition({ x: -5, y: 50 }, { minX: 0, maxX: 100 })).toEqual({ x: 0, y: 50 })
  })

  it('clampSize respects min/max', () => {
    expect(clampSize({ width: 5, height: 500 }, { width: 10, height: 10 }, { width: 100, height: 100 })).toEqual({
      width: 10,
      height: 100,
    })
  })

  it('snapToGrid rounds to cell', () => {
    expect(snapToGrid(14, 16)).toBe(16)
    expect(snapToGrid(7, 16)).toBe(0)
    expect(snapToGrid(10, 0)).toBe(10)
  })

  it('moveItemInArray moves the element', () => {
    expect(moveItemInArray(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItemInArray(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('getInsertionIndex finds position by Y', () => {
    const rects = [
      { top: 0, height: 40 },
      { top: 40, height: 40 },
      { top: 80, height: 40 },
    ]
    expect(getInsertionIndex(10, rects)).toBe(0)
    expect(getInsertionIndex(50, rects)).toBe(1)
    expect(getInsertionIndex(200, rects)).toBe(3)
  })

  it('resizeWithHandle SE grows w/h', () => {
    const { size } = resizeWithHandle({
      startSize: { width: 100, height: 100 },
      startMouse: { x: 0, y: 0 },
      currentMouse: { x: 20, y: 30 },
      handle: 'se',
    })
    expect(size).toEqual({ width: 120, height: 130 })
  })

  it('resizeWithHandle W shifts dx and respects min', () => {
    const { size, dx } = resizeWithHandle({
      startSize: { width: 100, height: 100 },
      startMouse: { x: 0, y: 0 },
      currentMouse: { x: 95, y: 0 },
      handle: 'w',
      min: { width: 50 },
    })
    expect(size.width).toBe(50)
    expect(dx).toBe(50)
  })

  it('resizeWithHandle keeps aspectRatio', () => {
    const { size } = resizeWithHandle({
      startSize: { width: 100, height: 50 },
      startMouse: { x: 0, y: 0 },
      currentMouse: { x: 100, y: 10 },
      handle: 'se',
      aspectRatio: 2,
    })
    expect(size.width / size.height).toBeCloseTo(2)
  })
})
