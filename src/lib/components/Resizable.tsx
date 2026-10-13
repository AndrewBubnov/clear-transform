import type { CSSProperties, ReactNode, Ref, RefObject } from 'react'
import { useResizable } from '../hooks/useResizable'
import type { UseResizableOptions } from '../hooks/useResizable'

interface ResizableProps extends UseResizableOptions {
  children: ReactNode
  ref?: Ref<HTMLDivElement>
  style?: CSSProperties
  className?: string
  /** Which handles to render (all 8 by default) */
  showHandles?: boolean
}

export function Resizable({ children, ref: outerRef, style, className, showHandles = true, ...options }: ResizableProps) {
  const { ref, size, position, handles, resizeHandleProps } = useResizable(options)

  const setRefs = (el: HTMLDivElement | null) => {
    const inner = ref as RefObject<HTMLDivElement | null>
    inner.current = el
    if (typeof outerRef === 'function') outerRef(el)
    else if (outerRef && typeof outerRef === 'object') {
      ;(outerRef as RefObject<HTMLDivElement | null>).current = el
    }
  }

  return (
    <div
      ref={setRefs}
      className={className}
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        ...style,
        // N/W handles shift the box origin via margins (not transform):
        // the layout footprint stays consistent, so the opposite edge
        // stays put AND the parent doesn't grow. A transform would move
        // the box visually while its layout box still grows the parent.
        marginTop: position.y,
        marginLeft: position.x,
      }}
    >
      {children}
      {showHandles &&
        handles.map((h) => <div key={h} {...resizeHandleProps(h)} />)}
    </div>
  )
}
