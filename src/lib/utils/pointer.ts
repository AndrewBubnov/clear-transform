/**
 * Best-effort pointer capture. Throws NotFoundError for pointers that are
 * not active (synthetic events, already-released pointers), so never let it
 * abort the drag/resize flow — the pointermove listeners still fire.
 */
export function tryCapturePointer(target: EventTarget | null, pointerId: number): void {
  try {
    ;(target as Element | null)?.setPointerCapture?.(pointerId)
  } catch {
    // Ignore: capture is an optimization, not a requirement.
  }
}
