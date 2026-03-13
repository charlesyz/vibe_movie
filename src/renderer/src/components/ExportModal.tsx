import { useState, useEffect } from 'react'
import { useStore } from '../store/store'
import type { ExportClip } from '../types'

interface Props {
  onClose: () => void
}

export function ExportModal({ onClose }: Props): JSX.Element {
  const { videos } = useStore()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [sidecarPath, setSidecarPath] = useState<string | null>(null)

  const totalClips = videos.reduce((sum, v) => sum + v.miniclips.length, 0)

  useEffect(() => {
    const unsubscribe = window.electronAPI.onExportProgress((pct) => {
      setProgress(pct)
    })
    return unsubscribe
  }, [])

  const handleExport = async (): Promise<void> => {
    setError(null)
    setProgress(0)

    const outputPath = await window.electronAPI.saveFileDialog()
    if (!outputPath) {
      setProgress(null)
      return
    }

    const clips: ExportClip[] = videos.flatMap((v) =>
      v.miniclips
        .slice()
        .sort((a, b) => a.start - b.start)
        .map((c) => ({
          videoPath: v.path,
          start: c.start,
          end: c.end,
          rotation: v.rotation
        }))
    )

    if (clips.length === 0) {
      setError('No miniclips to export. Define clips in the editor first.')
      setProgress(null)
      return
    }

    // Save session sidecar before export starts
    const jsonPath = outputPath.replace(/\.[^/.]+$/, '') + '.json'
    const session = { version: 1, savedAt: new Date().toISOString(), exportedTo: outputPath, videos }
    await window.electronAPI.saveSessionFile(session, jsonPath)
    setSidecarPath(jsonPath)

    try {
      await window.electronAPI.exportVideo(clips, outputPath)

      setDone(true)
      setProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
      setProgress(null)
    }
  }

  const isExporting = progress !== null && !done

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={!isExporting ? onClose : undefined}
    >
      <div
        className="bg-[#1e1e1e] rounded-xl p-6 w-[420px] shadow-xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-white mb-4">Export Video</h2>

        <div className="text-sm text-gray-400 mb-4">
          {totalClips} clip{totalClips !== 1 ? 's' : ''} across{' '}
          {videos.filter((v) => v.miniclips.length > 0).length} video
          {videos.filter((v) => v.miniclips.length > 0).length !== 1 ? 's' : ''}
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-300 text-xs p-3 rounded-lg mb-4">{error}</div>
        )}

        {done ? (
          <div className="bg-green-500/20 text-green-300 text-sm p-3 rounded-lg mb-4 space-y-1">
            <div>Export complete!</div>
            {sidecarPath && (
              <div className="text-xs text-green-400/70">
                Session saved to {sidecarPath.split('/').pop()}
              </div>
            )}
          </div>
        ) : progress !== null ? (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{progress >= 100 ? 'Finalizing...' : 'Exporting...'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              onClick={handleExport}
              disabled={isExporting || totalClips === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                         text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isExporting ? 'Exporting...' : 'Export MP4'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
