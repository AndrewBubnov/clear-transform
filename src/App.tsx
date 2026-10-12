import { useEffect, useRef } from 'react'
import { Link, Router, createRouter, useNavigate } from 'clear-react-router'
import { DashboardDemo } from './demo/DashboardDemo'
import { FreeDemo } from './demo/FreeDemo'
import { KanbanDemo } from './demo/KanbanDemo'
import { ResizeDemo } from './demo/ResizeDemo'
import { SortableDemo } from './demo/SortableDemo'

const tabs = [
  { to: '/free', label: 'Free drag' },
  { to: '/resize', label: 'Resize (8 handles)' },
  { to: '/sortable', label: 'Sortable' },
  { to: '/kanban', label: 'Kanban' },
  { to: '/dashboard', label: 'Dashboard grid' },
]

function RedirectToFree() {
  const navigate = useNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    navigate('/free')
  }, [navigate])
  return null
}

const routes = createRouter([
  { path: '/', element: <RedirectToFree /> },
  { path: '/free', element: <FreeDemo /> },
  { path: '/resize', element: <ResizeDemo /> },
  { path: '/sortable', element: <SortableDemo /> },
  { path: '/kanban', element: <KanbanDemo /> },
  { path: '/dashboard', element: <DashboardDemo /> },
  { path: '*', element: <RedirectToFree /> },
])

function tabClass({ isActive }: { isActive: boolean }) {
  return `rounded-full px-4 py-1.5 text-sm ${
    isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`
}

function App() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">clear-draggable — sandbox</h1>
        <p className="text-sm text-gray-500">React 19.3 • drag + resize • vitest • Vercel-ready</p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={tabClass}>
            {t.label}
          </Link>
        ))}
      </nav>
      <main className="rounded-xl border border-gray-200 p-4">
        <Router routes={routes} />
      </main>
    </div>
  )
}

export default App
