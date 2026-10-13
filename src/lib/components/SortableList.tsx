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
  height: number
}

interface ItemRect {
  top: number
  height: number
}

interface DragSession {
  id: string
  offsetX: number
  offsetY: number
  /** Item rects in collapsed order, captured at grab time. */
  frozen: ItemRect[]
}

/**
 * Pointer-based sorting.
 * The dragged item is lifted out of the flow (ghost only) so the rest
 * close ranks immediately — the first item in the path moves right away,
 * like Trello. A gap opens at the drop position and items slide aside.
 * Reorder commits once, on drop.
 *
 * Thresholds are frozen at grab time (collapsed coordinates, dragged item
 * excluded, gap never measured). The opening gap shifts live layout, so
 * measuring live rects would feed the shift back into the thresholds —
 * gap jitter, layout thrash and unreliable swaps. Frozen thresholds make
 * every computation deterministic; scroll/resize during the drag re-freezes.
 * A window-level pointerup backup commits the drop even when the release
 * happens outside the window and the container never sees it.
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
  const dragRef = useRef<DragSession | null>(null)
  // Live item nodes keyed by id. Used only to (re)capture the frozen
  // frame — never for per-move measuring.
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const ghostRef = useRef<HTMLDivElement | null>(null)
  // Window listeners attached for the active drag (release backup outside
  // the container + scroll/resize re-freeze). Detached on finish.
  const windowListeners = useRef<{
    up: (e: PointerEvent) => void
    cancel: () => void
    refreeze: () => void
  } | null>(null)
  // Latest ghost position. Updated imperatively on every move (no re-render);
  // read during render so re-renders caused by drop-index changes keep the ghost put.
  const ghostPos = useRef({ x: 0, y: 0 })
  const [ghost, setGhost] = useState<Ghost | null>(null)
  // Insertion index in collapsed coordinates (dragged item excluded).
  // Reorder commits once, on drop — during the drag only the gap moves.
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const setFragmentRefs = (instance: FragmentInstance | null) => {
    fragmentRef.current = instance
    if (typeof outerRef === 'function') outerRef(instance)
    else if (outerRef && typeof outerRef === 'object') {
      ;(outerRef as RefObject<FragmentInstance | null>).current = instance
    }
  }

  const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }

  const detachWindowListeners = () => {
    const l = windowListeners.current
    windowListeners.current = null
    if (!l) return
    window.removeEventListener('pointerup', l.up)
    window.removeEventListener('pointercancel', l.cancel)
    window.removeEventListener('scroll', l.refreeze, true)
    window.removeEventListener('resize', l.refreeze)
  }

  /** Measure visible items (dragged excluded) in items order. Null on missing nodes. */
  const measureCollapsed = (dragId: string): ItemRect[] | null => {
    const rects: ItemRect[] = []
    for (const item of items) {
      if (item.id === dragId) continue
      const r = itemRefs.current.get(item.id)?.getBoundingClientRect()
      if (!r) return null
      rects.push({
        top: orientation === 'vertical' ? r.top : r.left,
        height: (orientation === 'vertical' ? r.height : r.width) || 1,
      })
    }
    return rects
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
    const frozen = measureCollapsed(id)
    if (!frozen) return
    dragRef.current = { id, offsetX, offsetY, frozen }
    // Rounded here too — the ghost mounts with these coords before
    // the first moveGhost call (see moveGhost for why).
    ghostPos.current = { x: Math.round(e.clientX - offsetX), y: Math.round(e.clientY - offsetY) }
    setGhost({ id, width: Math.round(rect.width), height: Math.round(rect.height) })
    // Pre-fill the home slot: the gap starts where the item was lifted
    // from, so the layout never jumps on grab and dragging back always
    // shows a landing window — even at the origin edge.
    setDropIndex(items.findIndex((i) => i.id === id))
    tryCapturePointer(el, e.pointerId)

    // Window-level backup: the container misses the release when it
    // happens outside the window, and scroll/resize shifts live layout
    // under the frozen thresholds. Down-closure captures items/onReorder,
    // which stay valid for the whole drag (no commits until drop).
    const finish = finishDrag
    const onWindowUp = (ev: PointerEvent) => {
      if (!dragRef.current) return
      finish(true, { clientX: ev.clientX, clientY: ev.clientY })
    }
    const onWindowCancel = () => {
      if (!dragRef.current) return
      finish(false)
    }
    const refreeze = () => {
      const drag = dragRef.current
      if (!drag) return
      const fresh = measureCollapsed(drag.id)
      if (fresh) {
        drag.frozen = fresh
      }
    }
    detachWindowListeners()
    windowListeners.current = { up: onWindowUp, cancel: onWindowCancel, refreeze }
    window.addEventListener('pointerup', onWindowUp)
    window.addEventListener('pointercancel', onWindowCancel)
    window.addEventListener('scroll', refreeze, true)
    window.addEventListener('resize', refreeze)
  }

  /**
   * Insertion index for the given pointer position, in collapsed
   * coordinates (0..visibleCount). Pure function of the frozen frame —
   * same input always yields same output, regardless of live layout.
   */
  const resolveDropIndex = (
    drag: Pick<DragSession, 'id' | 'frozen'>,
    clientX: number,
    clientY: number,
  ): { from: number; to: number } | null => {
    const from = items.findIndex((i) => i.id === drag.id)
    if (from === -1) {
      return null
    }
    const coord = orientation === 'vertical' ? clientY : clientX
    const to = getInsertionIndex(coord, drag.frozen)
    return { from, to }
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    moveGhost(e.clientX - drag.offsetX, e.clientY - drag.offsetY)
    const resolved = resolveDropIndex(drag, e.clientX, e.clientY)
    if (!resolved) return
    // Re-render only when the gap actually moves slots.
    setDropIndex((prev) => (prev === resolved.to ? prev : resolved.to))
  }

  const finishDrag = (commit: boolean, point?: { clientX: number; clientY: number }) => {
    const drag = dragRef.current
    dragRef.current = null
    setGhost(null)
    setDropIndex(null)
    detachWindowListeners()
    if (!commit || !drag || !point) {
      return
    }
    // Recompute at drop point against the same frozen frame as the moves,
    // so the drop always lands where shown — no drift possible.
    const resolved = resolveDropIndex(drag, point.clientX, point.clientY)
    if (!resolved) return
    const { from, to } = resolved
    // Landing back at the origin slot is a no-op (same index in collapsed
    // coordinates means the array comes back unchanged).
    if (to !== from) {
      onReorder(moveItemInArray(items, from, to))
    }
  }

  const endDrag = (e: ReactPointerEvent) => finishDrag(true, { clientX: e.clientX, clientY: e.clientY })
  const cancelDrag = () => finishDrag(false)

  const ghostItem = ghost ? items.find((i) => i.id === ghost.id) : undefined
  // The dragged item lives only as a ghost — the list renders collapsed.
  const visibleItems = ghost ? items.filter((i) => i.id !== ghost.id) : items
  // The gap always marks the landing, including the home slot on return:
  // hiding it at the origin reads as "broken, no window opens".
  const showGap = ghost !== null && dropIndex !== null
  const gapStyle =
    orientation === 'vertical'
      ? { height: ghost?.height }
      : { width: ghost?.width, alignSelf: 'stretch' }

  return (
    <div
      className={className}
      role="list"
      aria-orientation={orientation}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      style={{ touchAction: 'none', userSelect: 'none' }}
    >
      <Fragment ref={setFragmentRefs}>
        {visibleItems.map((item, index) => (
          <Fragment key={item.id}>
            {showGap && dropIndex === index && (
              <div
                data-sortable-gap
                aria-hidden="true"
                style={{
                  ...gapStyle,
                  borderRadius: 8,
                  border: '1px dashed #6366f1',
                  background: '#eef2ff',
                }}
              />
            )}
            <div
              role="listitem"
              data-sortable-id={item.id}
              ref={setItemRef(item.id)}
              onPointerDown={handleItemPointerDown(item.id)}
              style={{
                cursor: 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              {renderItem(item, items.indexOf(item))}
            </div>
          </Fragment>
        ))}
        {showGap && dropIndex === visibleItems.length && (
          <div
            data-sortable-gap
            aria-hidden="true"
            style={{
              ...gapStyle,
              borderRadius: 8,
              border: '1px dashed #6366f1',
              background: '#eef2ff',
            }}
          />
        )}
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
