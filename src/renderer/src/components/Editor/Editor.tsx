import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '../../store/store'
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer'
import { Timeline } from './Timeline'
import { snapStart, snapEnd } from '../../utils/keyframes'

export function Editor(): JSX.Element {
  const {
    videos,
    selectedVideoId,
    selectedMiniclipId,
    pendingMiniclip,
    setSelectedVideoId,
    rotateVideo,
    startMiniclip,
    stopMiniclip,
    updateMiniclip,
    deleteMiniclip,
    setSelectedMiniclipId
  } = useStore()

  const playerRef = useRef<VideoPlayerHandle>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const video = videos.find((v) => v.id === selectedVideoId) ?? null

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      // Don't trigger if focus is in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!video) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          playerRef.current?.toggle()
          break

        case 'ArrowLeft':
          e.preventDefault()
          {
            const delta = e.shiftKey ? 5 : 2
            const newTime = Math.max(0, (playerRef.current?.getCurrentTime() ?? 0) - delta)
            playerRef.current?.seek(newTime)
            setCurrentTime(newTime)
          }
          break

        case 'ArrowRight':
          e.preventDefault()
          {
            const delta = e.shiftKey ? 5 : 2
            const newTime = Math.min(
              duration,
              (playerRef.current?.getCurrentTime() ?? 0) + delta
            )
            playerRef.current?.seek(newTime)
            setCurrentTime(newTime)
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          {
            const idx = videos.findIndex((v) => v.id === selectedVideoId)
            if (idx > 0) setSelectedVideoId(videos[idx - 1].id)
          }
          break

        case 'ArrowDown':
          e.preventDefault()
          {
            const idx = videos.findIndex((v) => v.id === selectedVideoId)
            if (idx < videos.length - 1) setSelectedVideoId(videos[idx + 1].id)
          }
          break

        case 'c':
        case 'C':
          e.preventDefault()
          {
            const kf = video.keyframes ?? []
            if (!pendingMiniclip) {
              const t = snapStart(playerRef.current?.getCurrentTime() ?? 0, kf)
              playerRef.current?.seek(t)
              startMiniclip(video.id, t)
            } else {
              const t = snapEnd(playerRef.current?.getCurrentTime() ?? 0, kf)
              playerRef.current?.seek(t)
              stopMiniclip(video.id, t)
            }
          }
          break

        case 'Backspace':
        case 'Delete':
          if (selectedMiniclipId) {
            e.preventDefault()
            deleteMiniclip(video.id, selectedMiniclipId)
          }
          break

        case 'Escape':
          if (pendingMiniclip) {
            useStore.getState().cancelPendingMiniclip()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [
    video,
    videos,
    selectedVideoId,
    duration,
    pendingMiniclip,
    selectedMiniclipId,
    setSelectedVideoId,
    startMiniclip,
    stopMiniclip,
    deleteMiniclip
  ])

  const handleSeek = useCallback(
    (time: number) => {
      playerRef.current?.seek(time)
      setCurrentTime(time)
    },
    []
  )

  const handleUpdateMiniclip = useCallback(
    (clipId: string, updates: { start?: number; end?: number }) => {
      if (video) updateMiniclip(video.id, clipId, updates)
    },
    [video, updateMiniclip]
  )

  if (!video) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Select a video from the sidebar to edit
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-[#1a1a1a]">
        <span className="text-sm font-medium text-gray-200 truncate flex-1">{video.name}</span>

        {/* Pending clip indicator */}
        {pendingMiniclip && (
          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full animate-pulse">
            Recording... (press C to stop)
          </span>
        )}

        <button
          onClick={() => rotateVideo(video.id)}
          title="Rotate 90°"
          className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-gray-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>

        {selectedMiniclipId && (
          <button
            onClick={() => deleteMiniclip(video.id, selectedMiniclipId)}
            title="Delete selected clip (Backspace)"
            className="p-1.5 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors text-xs"
          >
            Delete Clip
          </button>
        )}

        <div className="text-xs text-gray-500">
          {video.miniclips.length} clip{video.miniclips.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Video player */}
      <VideoPlayer
        ref={playerRef}
        video={video}
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
      />

      {/* Hotkeys hint */}
      <div className="px-4 py-1.5 flex gap-4 text-xs text-gray-600 border-t border-white/5">
        <span>Space: play/pause</span>
        <span>← →: seek 2s (shift: 5s)</span>
        <span>↑↓: switch video</span>
        <span>C: start/stop clip</span>
        <span>Backspace: delete clip</span>
      </div>

      {/* Timeline */}
      <Timeline
        duration={duration}
        currentTime={currentTime}
        miniclips={video.miniclips}
        selectedMiniclipId={selectedMiniclipId}
        pendingMiniclip={pendingMiniclip}
        keyframes={video.keyframes}
        onSeek={handleSeek}
        onSelectMiniclip={setSelectedMiniclipId}
        onUpdateMiniclip={handleUpdateMiniclip}
      />
    </div>
  )
}
