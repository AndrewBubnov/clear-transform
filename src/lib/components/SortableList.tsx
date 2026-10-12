import { Fragment, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode, Ref, RefObject } from 'react'
import type { FragmentInstance } from 'react'
import { getInsertionIndex, moveItemInArray } from '../utils/geometry'
import { tryCapturePointer } from '../utils/pointer'

export interface SortableItem {
  id: string
}

interface SortableListProps<T extends SortableItem> {
  items: T[]
  onReorder: (items: T[]) => void
  renderItem: (item: T, index: number) => ReactNode
  /**
   * Ghost content. Defaults to renderItem, but list spacing (margins)
   * belongs to the list, not the floating card — pass a tight renderer
   * here or the overlay keeps a transparent margin strip under the card.
   */
  renderGhost?: (item: T, index: number) => ReactNode
  /** ref as prop on the Fragment — group measuring without querySelector (React 19.3) */
  ref?: Ref<FragmentInstance>
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

interface Ghost {
  id: string
  width: number
}

/**
 * Pointer-based sorting.
 * Items are wrapped in <Fragment ref> — measured via
 * fragment.getClientRects(), no extra wrappers or querySelector.
 * The dragged item follows the cursor as a fixed overlay ghost,
 * the origin slot dims as a placeholder.
 */
export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  renderGhost = renderItem,
  ref: outerRef,
  orientation = 'vertical',
  className,
}: SortableListProps<T>) {
  const fragmentRef = useRef<FragmentInstance | null>(null)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  // Latest ghost position. Updated imperatively on every move (no re-render);
  // read during render so re-renders caused by reordering keep the ghost put.
  const ghostPos = useRef({ x: 0, y: 0 })
  const [ghost, setGhost] = useState<Ghost | null>(null)

  const setFragmentRefs = (instance: FragmentInstance | null) => {
    fragmentRef.current = instance
    if (typeof outerRef === 'function') outerRef(instance)
    else if (outerRef && typeof outerRef === 'object') {
      ;(outerRef as RefObject<FragmentInstance | null>).current = instance
    }
  }

  const moveGhost = (x: number, y: number) => {
    // Whole pixels only: a fractional translate straddles physical pixels
    // and blurs 1px borders into "double" lines.
    const snapped = { x: Math.round(x), y: Math.round(y) }
    ghostPos.current = snapped
    const el = ghostRef.current
    if (el) el.style.transform = `translate(${snapped.x}px, ${snapped.y}px)`
  }

  const handleItemPointerDown = (id: string) => (e: ReactPointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return
    // Kill native text selection and image dragging, they ruin the drag feel.
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    dragRef.current = { id, offsetX, offsetY }
    // Rounded here too — the ghost mounts with these coords before
    // the first moveGhost call (see moveGhost for why).
    ghostPos.current = { x: Math.round(e.clientX - offsetX), y: Math.round(e.clientY - offsetY) }
    setGhost({ id, width: Math.round(rect.width) })
    tryCapturePointer(el, e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    moveGhost(e.clientX - drag.offsetX, e.clientY - drag.offsetY)
    const rects = fragmentRef.current?.getClientRects() ?? []
    const from = items.findIndex((i) => i.id === drag.id)
    if (from === -1) return
    const coord = orientation === 'vertical' ? e.clientY : e.clientX
    const to = getInsertionIndex(
      coord,
      Array.from(rects).map((r) => ({
        top: orientation === 'vertical' ? r.top : r.left,
        height: orientation === 'vertical' ? r.height || 1 : r.width || 1,
      })),
    )
    const adjusted = to > from ? to - 1 : to
    if (adjusted !== from && adjusted >= 0 && adjusted < items.length) {
      onReorder(moveItemInArray(items, from, adjusted))
    }
  }

  const endDrag = () => {
    dragRef.current = null
    setGhost(null)
  }

  const ghostItem = ghost ? items.find((i) => i.id === ghost.id) : undefined

  return (
    <div
      className={className}
      role="list"
      aria-orientation={orientation}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ touchAction: 'none', userSelect: 'none' }}
    >
      <Fragment ref={setFragmentRefs}>
        {items.map((item, index) => (
          <div
            key={item.id}
            role="listitem"
            data-sortable-id={item.id}
            onPointerDown={handleItemPointerDown(item.id)}
            style={{
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none',
              opacity: ghost?.id === item.id ? 0.35 : undefined,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </Fragment>
      {ghostItem && ghost && (
        <div
          ref={ghostRef}
          data-sortable-ghost={ghost.id}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: ghost.width || undefined,
            transform: `translate(${ghostPos.current.x}px, ${ghostPos.current.y}px)`,
            pointerEvents: 'none',
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            borderRadius: 8,
            cursor: 'grabbing',
          }}
        >
          {renderGhost(ghostItem, items.indexOf(ghostItem))}
        </div>
      )}
    </div>
  )
}
