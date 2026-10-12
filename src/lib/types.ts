import type { Ref } from 'react'

// React 19.3: FragmentInstance is augmented by react-dom
// (focus, observeUsing, getClientRects, addEventListener, ...).
// Import from 'react' resolves once @types/react-dom is present.
// Pull in the `FragmentInstance` augmentation from react-dom (19.3):
// focus/blur, observeUsing, getClientRects, addEventListener, ...
import type {} from 'react-dom'
import type { FragmentInstance } from 'react'

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Bounds {
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
}

/** 8 resize handles around the perimeter */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const ALL_HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/** A DOM node or a wrapper-less group (React 19.3 Fragment Refs) */
export type DragTarget = HTMLElement | FragmentInstance

export type DragTargetRef = Ref<DragTarget>

export function isHTMLElement(target: DragTarget | null): target is HTMLElement {
  return target instanceof HTMLElement
}

export interface DragState {
  position: Position
  isDragging: boolean
}

export interface ResizeState {
  size: Size
  isResizing: boolean
  activeHandle: ResizeHandle | null
}
