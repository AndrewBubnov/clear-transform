import { Draggable } from '../lib'

export function FreeDemo() {
  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Drag the boxes from any point. Uncontrolled position, drag end goes to console.
      </p>
      <div className="relative h-72 rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <Draggable onDragEnd={(p) => console.log('drag end', p)}>
          <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-indigo-500 text-white shadow">
            drag me
          </div>
        </Draggable>
        <Draggable defaultPosition={{ x: 180, y: 60 }} bounds={{ minX: 0, minY: 0 }} grid={16}>
          <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-emerald-500 text-white shadow">
            snap 16px
          </div>
        </Draggable>
      </div>
    </div>
  )
}
