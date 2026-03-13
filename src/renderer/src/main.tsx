import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useStore } from './store/store'

// Auto-save: debounce 1s after any store change
let saveTimer: ReturnType<typeof setTimeout> | null = null
useStore.subscribe((state) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    window.electronAPI.saveState({ videos: state.videos }).catch(() => {})
  }, 1000)
})

// Load persisted state before first render
async function init(): Promise<void> {
  try {
    const saved = await window.electronAPI.loadState() as { videos?: unknown[] } | null
    if (saved?.videos && Array.isArray(saved.videos) && saved.videos.length > 0) {
      useStore.getState().initFromSaved(saved.videos as never)
    }
  } catch {
    // ignore
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

init()
