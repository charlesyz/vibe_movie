import { useState } from 'react'
import './assets/main.css'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { Preview } from './components/Preview/Preview'
import { ExportModal } from './components/ExportModal'
import { useStore } from './store/store'

function App(): JSX.Element {
  const { view, setView, videos } = useStore()
  const [showExport, setShowExport] = useState(false)

  const totalClips = videos.reduce((sum, v) => sum + v.miniclips.length, 0)

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0f0f] text-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-[#141414]">
          {/* View tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setView('editor')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                view === 'editor'
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setView('preview')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                view === 'preview'
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Preview
            </button>
          </div>

          {/* App title */}
          <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
            Vibe Movie
          </span>

          {/* Export button */}
          <button
            onClick={() => setShowExport(true)}
            disabled={totalClips === 0}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30
                       text-white text-xs font-medium rounded-lg transition-colors"
          >
            Export {totalClips > 0 ? `(${totalClips})` : ''}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {view === 'editor' ? <Editor /> : <Preview />}
        </div>
      </div>

      {/* Export modal */}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  )
}

export default App
