import type { CSSProperties, ReactNode, Ref, RefObject } from 'react'
import { useDraggable } from '../hooks/useDraggable'
import type { UseDraggableOptions } from '../hooks/useDraggable'

interface DraggableProps extends UseDraggableOptions {
  children: ReactNode
  /** ref as prop (React 19). Forwarded to the wrapper div */
  ref?: Ref<HTMLDivElement>
  style?: CSSProperties
  className?: string
}

export function Draggable({ children, ref: outerRef, style, className, ...options }: DraggableProps) {
  const { isDragging, dragHandleProps, dragStyle } = useDraggable(options)

  // Merge the hook's inner ref with the outer ref via callback
  const setRefs = (el: HTMLDivElement | null) => {
    ;(dragHandleProps.ref as RefObject<HTMLDivElement | null>).current = el
    if (typeof outerRef === 'function') outerRef(el)
    else if (outerRef && typeof outerRef === 'object') (outerRef as RefObject<HTMLDivElement | null>).current = el
  }

  return (
    <div
      {...dragHandleProps}
      ref={setRefs}
      className={className}
      data-dragging={isDragging}
      style={{
        ...dragStyle,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
