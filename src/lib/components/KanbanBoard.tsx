import { Fragment, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode, Ref, RefObject } from 'react'
import type { FragmentInstance } from 'react'
import { tryCapturePointer } from '../utils/pointer'

export interface KanbanColumn {
  id: string
  title: string
}

export interface KanbanCard {
  id: string
  columnId: string
}

interface KanbanBoardProps<TCard extends KanbanCard> {
  columns: KanbanColumn[]
  cards: TCard[]
  onMove: (cardId: string, toColumnId: string, toIndex: number) => void
  renderCard: (card: TCard) => ReactNode
  /** Ghost content, defaults to renderCard. See SortableList renderGhost. */
  renderGhost?: (card: TCard) => ReactNode
  ref?: Ref<FragmentInstance>
  className?: string
}

const COLUMN_ATTR = 'data-kanban-column'

/**
 * Resolve the drop column under the cursor. Pointer capture retargets
 * pointerup to the capture element, so the event target can't be trusted —
 * hit-testing by coordinates works regardless of capture.
 */
function columnFromPoint(x: number, y: number): string | null {
  if (typeof document.elementFromPoint !== 'function') return null
  const el = document.elementFromPoint(x, y)?.closest?.(`[${COLUMN_ATTR}]`)
  return el?.getAttribute?.(COLUMN_ATTR) ?? null
}

/**
 * Kanban v0.1: drag cards between columns with a cursor-following ghost.
 * Drop lands at the end of the highlighted column.
 * Columns are wrapped in a Fragment with ref for group measuring.
 */
export function KanbanBoard<TCard extends KanbanCard>({
  columns,
  cards,
  onMove,
  renderCard,
  renderGhost = renderCard,
  ref: outerRef,
  className,
}: KanbanBoardProps<TCard>) {
  const fragmentRef = useRef<FragmentInstance | null>(null)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  // Latest ghost position, updated imperatively (see SortableList ghostPos).
  const ghostPos = useRef({ x: 0, y: 0 })
  const [ghost, setGhost] = useState<{ id: string; width: number } | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)

  const setFragmentRefs = (instance: FragmentInstance | null) => {
    fragmentRef.current = instance
    if (typeof outerRef === 'function') outerRef(instance)
    else if (outerRef && typeof outerRef === 'object') {
      ;(outerRef as RefObject<FragmentInstance | null>).current = instance
    }
  }

  const moveGhost = (x: number, y: number) => {
    // Whole pixels only (see SortableList moveGhost).
    const snapped = { x: Math.round(x), y: Math.round(y) }
    ghostPos.current = snapped
    const el = ghostRef.current
    if (el) el.style.transform = `translate(${snapped.x}px, ${snapped.y}px)`
  }

  const handleCardPointerDown = (id: string) => (e: ReactPointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return
    // Kill native text selection, it ruins the drag feel.
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    dragRef.current = { id, offsetX, offsetY }
    ghostPos.current = { x: Math.round(e.clientX - offsetX), y: Math.round(e.clientY - offsetY) }
    setGhost({ id, width: Math.round(rect.width) })
    setOverColumn(null)
    tryCapturePointer(el, e.pointerId)
  }

  const handleBoardPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    moveGhost(e.clientX - drag.offsetX, e.clientY - drag.offsetY)
    setOverColumn(columnFromPoint(e.clientX, e.clientY))
  }

  const endDrag = (e?: ReactPointerEvent) => {
    const drag = dragRef.current
    dragRef.current = null
    setGhost(null)
    setOverColumn(null)
    if (!drag || !e) return
    const target = columnFromPoint(e.clientX, e.clientY)
    if (!target) return
    const card = cards.find((c) => c.id === drag.id)
    // Same column: v0.1 has no intra-column positioning, treat as no-op.
    if (!card || card.columnId === target) return
    onMove(drag.id, target, cards.filter((c) => c.columnId === target).length)
  }

  const ghostCard = ghost ? cards.find((c) => c.id === ghost.id) : undefined

  return (
    <div
      className={className}
      onPointerMove={handleBoardPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => endDrag()}
      style={{ display: 'flex', gap: 12, touchAction: 'none', userSelect: 'none' }}
    >
      <Fragment ref={setFragmentRefs}>
        {columns.map((col) => {
          const colCards = cards.filter((c) => c.columnId === col.id)
          const isTarget = overColumn === col.id
          return (
            <div
              key={col.id}
              data-kanban-column={col.id}
              data-drop-target={isTarget}
              style={{
                flex: 1,
                minWidth: 0,
                border: `1px solid ${isTarget ? '#6366f1' : '#e5e7eb'}`,
                borderRadius: 8,
                padding: 8,
                background: isTarget ? '#eef2ff' : undefined,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{col.title}</div>
              {colCards.map((card) => (
                <div
                  key={card.id}
                  data-kanban-card={card.id}
                  onPointerDown={handleCardPointerDown(card.id)}
                  style={{
                    cursor: 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    marginBottom: 8,
                    opacity: ghost?.id === card.id ? 0.35 : undefined,
                  }}
                >
                  {renderCard(card)}
                </div>
              ))}
            </div>
          )
        })}
      </Fragment>
      {ghostCard && ghost && (
        <div
          ref={ghostRef}
          data-kanban-ghost={ghost.id}
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
          {renderGhost(ghostCard)}
        </div>
      )}
    </div>
  )
}
