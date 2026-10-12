import { useState } from 'react'
import { Resizable } from '../lib'

export function ResizeDemo() {
  const [aspect, setAspect] = useState(false)
  return (
    <div>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={aspect} onChange={(e) => setAspect(e.target.checked)} />
        keep 2:1 aspect ratio
      </label>
      <div className="flex gap-6">
        <Resizable
          defaultSize={{ width: 220, height: 140 }}
          min={{ width: 80, height: 60 }}
          max={{ width: 480, height: 360 }}
          aspectRatio={aspect ? 2 : undefined}
          onResizeEnd={(s) => console.log('resize end', s)}
        >
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-amber-100 text-sm text-amber-900">
            drag by any of the 8 handles
          </div>
        </Resizable>
      </div>
    </div>
  )
}
