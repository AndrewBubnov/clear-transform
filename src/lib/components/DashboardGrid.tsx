import { Fragment, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode, Ref, RefObject } from 'react'
import type { FragmentInstance } from 'react'
import { snapToGrid } from '../utils/geometry'
import { tryCapturePointer } from '../utils/pointer'
import type { Position } from '../types'

export interface DashboardWidget {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface DashboardGridProps {
  widgets: DashboardWidget[]
  onMove: (id: string, pos: Position) => void
  renderWidget: (widget: DashboardWidget) => ReactNode
  ref?: Ref<FragmentInstance>
  cell?: number
  /** Draw the snap grid as the board background. Pure decoration. */
  showGrid?: boolean
  className?: string
}

/**
 * Free-form board with snap-to-grid. Each widget is moved
 * via pointer drag, the position snaps to the `cell` grid.
 */
export function DashboardGrid({
  widgets,
  onMove,
  renderWidget,
  ref: outerRef,
  cell = 16,
  showGrid = false,
  className,
}: DashboardGridProps) {
  const fragmentRef = useRef<FragmentInstance | null>(null)
  const [drag, setDrag] = useState<{ id: string; offset: Position; origin: Position } | null>(null)

  const setFragmentRefs = (instance: FragmentInstance | null) => {
    fragmentRef.current = instance
    if (typeof outerRef === 'function') outerRef(instance)
    else if (outerRef && typeof outerRef === 'object') {
      ;(outerRef as RefObject<FragmentInstance | null>).current = instance
    }
  }

  const handleWidgetPointerDown = (w: DashboardWidget) => (e: ReactPointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    setDrag({
      id: w.id,
      offset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      origin: { x: w.x, y: w.y },
    })
    // Capture last: a throwing capture must not abort the drag.
    tryCapturePointer(target, e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!drag) return
    const board = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const raw = {
      x: e.clientX - board.left - drag.offset.x,
      y: e.clientY - board.top - drag.offset.y,
    }
    onMove(drag.id, {
      x: Math.max(0, snapToGrid(raw.x, cell)),
      y: Math.max(0, snapToGrid(raw.y, cell)),
    })
  }

  const endDrag = () => setDrag(null)

  return (
    <div
      className={className}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: 'relative',
        minHeight: 400,
        touchAction: 'none',
        ...(showGrid && cell > 0
          ? {
              backgroundImage:
                'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
              backgroundSize: `${cell}px ${cell}px`,
            }
          : undefined),
      }}
    >
      <Fragment ref={setFragmentRefs}>
        {widgets.map((w) => (
          <div
            key={w.id}
            data-widget-id={w.id}
            onPointerDown={handleWidgetPointerDown(w)}
            style={{
              position: 'absolute',
              left: w.x,
              top: w.y,
              width: w.w,
              height: w.h,
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            {renderWidget(w)}
          </div>
        ))}
      </Fragment>
    </div>
  )
}
