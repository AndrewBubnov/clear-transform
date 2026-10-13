import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  // Last known rects per id. A node missing mid-flight (the previous ghost,
  // never committed) still sits at its last spot — memory keeps grabs working
  // during the 200ms flight instead of dead-bailing. Rebuilt on every
  // successful measure, so it never goes stale.
  const lastRects = useRef(new Map<string, ItemRect>())
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
  // FLIP bookkeeping: tops from the last committed layout + running animations.
  const prevTops = useRef(new Map<string, number>())
  const animations = useRef<Animation[]>([])
  // Pending drop fly-in: commit runs when the ghost lands in the gap.
  // Abandoned (never committed) when a new drag starts or on unmount.
  const pendingDrop = useRef<{ anim: Animation; from: number; to: number } | null>(null)
  // The open gap node — the fly-in target. Only one gap renders at a time.
  const gapRef = useRef<HTMLDivElement | null>(null)
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

  const cancelAnimations = () => {
    for (const anim of animations.current) {
      try {
        anim.cancel()
      } catch {
        // Already finished — nothing to cancel.
      }
    }
    animations.current = []
  }

  /** Abandon a mid-fly drop commit (new grab or unmount). The list was never reordered. */
  const cancelPendingDrop = () => {
    const p = pendingDrop.current
    pendingDrop.current = null
    if (!p) return
    try {
      p.anim.cancel()
    } catch {
      // Already finished — nothing to cancel.
    }
  }

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // FLIP: when the gap moves (or items reorder on drop), glide items from
  // their previous tops to the new ones instead of jumping. Web Animations
  // leave no inline-style residue, so measuring stays clean.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      prevTops.current.clear()
      return
    }
    for (const item of items) {
      const el = itemRefs.current.get(item.id)
      if (!el || typeof el.animate !== 'function') {
        prevTops.current.delete(item.id)
        continue
      }
      const axis = orientation === 'vertical' ? 'top' : 'left'
      const pos = el.getBoundingClientRect()[axis]
      const prev = prevTops.current.get(item.id)
      prevTops.current.set(item.id, pos)
      if (prev === undefined) continue
      const delta = prev - pos
      if (delta === 0) continue
      const prop = orientation === 'vertical' ? 'translateY' : 'translateX'
      const anim = el.animate(
        [{ transform: `${prop}(${delta}px)` }, { transform: `${prop}(0px)` }],
        { duration: 180, easing: 'ease-out' },
      )
      animations.current.push(anim)
    }
    // Drop bookkeeping for unmounted ids.
    for (const id of [...prevTops.current.keys()]) {
      if (!items.some((item) => item.id === id)) prevTops.current.delete(id)
    }
  }, [items, dropIndex, orientation])

  // Unmount cleanup for in-flight animations and pending drops.
  useEffect(
    () => () => {
      cancelAnimations()
      cancelPendingDrop()
    },
    [],
  )

  const detachWindowListeners = () => {
    const l = windowListeners.current
    windowListeners.current = null
    if (!l) return
    window.removeEventListener('pointerup', l.up)
    window.removeEventListener('pointercancel', l.cancel)
    window.removeEventListener('scroll', l.refreeze, true)
    window.removeEventListener('resize', l.refreeze)
  }

  const toCollapsed = (r: { top: number; left: number; width: number; height: number }): ItemRect => ({
    top: orientation === 'vertical' ? r.top : r.left,
    height: (orientation === 'vertical' ? r.height : r.width) || 1,
  })

  /** Measure visible items (dragged excluded) in items order. Null on missing nodes. */
  const measureCollapsed = (dragId: string): ItemRect[] | null => {
    const rects: ItemRect[] = []
    const memory = new Map<string, ItemRect>()
    for (const item of items) {
      if (item.id === dragId) continue
      const live = itemRefs.current.get(item.id)?.getBoundingClientRect()
      // A node missing mid-flight (a previous ghost, never committed) still
      // sits at its last known spot — reuse memory so grabs never dead-bail.
      // Missing with no memory means mid-mount: bail safely, never mis-map.
      const mapped = live ? toCollapsed(live) : lastRects.current.get(item.id)
      if (!mapped) return null
      memory.set(item.id, mapped)
      rects.push(mapped)
    }
    lastRects.current = memory
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
    // Seed memory with the lifted item: a grab overlapping this flight
    // finds it here (it never committed anywhere else).
    lastRects.current.set(id, toCollapsed(rect))
    // A new grab measures clean positions — kill leftover animations first.
    // A mid-fly drop from a previous drag is abandoned (never committed).
    cancelAnimations()
    cancelPendingDrop()
    // Drop FLIP history for the lifted item: on landing it must appear
    // exactly where the ghost was, not glide in again from the origin.
    prevTops.current.delete(id)
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
    detachWindowListeners()
    if (!commit || !drag || !point) {
      // Abort: instant cleanup, nothing committed.
      setGhost(null)
      setDropIndex(null)
      return
    }
    // Recompute at drop point against the same frozen frame as the moves,
    // so the drop always lands where shown — no drift possible.
    const resolved = resolveDropIndex(drag, point.clientX, point.clientY)
    if (!resolved) {
      setGhost(null)
      setDropIndex(null)
      return
    }
    const { from, to } = resolved
    // Landing back at the origin slot is a no-op (same index in collapsed
    // coordinates means the array comes back unchanged).
    if (to === from) {
      setGhost(null)
      setDropIndex(null)
      return
    }
    // Fly the ghost into the open gap, commit on landing. The ghost stays
    // mounted (and the gap stays open) for the flight duration.
    const gapEl = gapRef.current
    const ghostEl = ghostRef.current
    if (!gapEl || !ghostEl || typeof ghostEl.animate !== 'function' || prefersReducedMotion()) {
      onReorder(moveItemInArray(items, from, to))
      setGhost(null)
      setDropIndex(null)
      return
    }
    const gr = gapEl.getBoundingClientRect()
    const fromX = ghostPos.current.x
    const fromY = ghostPos.current.y
    const toX = Math.round(gr.left)
    const toY = Math.round(gr.top)
    // fill:forwards pins the end frame: without it the effect lifts on
    // finish and the ghost snaps back to its inline transform for the
    // frames before React unmounts it (30-50ms blink).
    const anim = ghostEl.animate(
      [
        { transform: `translate(${fromX}px, ${fromY}px)` },
        { transform: `translate(${toX}px, ${toY}px)` },
      ],
      { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    )
    const token = { anim, from, to }
    pendingDrop.current = token
    anim.finished.then(() => {
      // A new grab or unmount abandons the flight (list was never reordered).
      if (pendingDrop.current !== token) return
      pendingDrop.current = null
      // Sync the inline position too: if anything renders the ghost once
      // more before unmount, it must already sit at the landing.
      ghostPos.current = { x: toX, y: toY }
      onReorder(moveItemInArray(items, from, to))
      setGhost(null)
      setDropIndex(null)
    }).catch(() => {
      // Cancelled mid-flight — cleanup already handled by the canceller.
    })
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
                ref={gapRef}
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
            ref={gapRef}
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
