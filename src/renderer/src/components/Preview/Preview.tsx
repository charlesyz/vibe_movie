import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '../../store/store'

interface Segment {
  videoPath: string
  videoName: string
  videoId: string
  clipId: string
  start: number
  end: number
  rotation: number
}

export function Preview(): JSX.Element {
  const { videos } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)

  const segments: Segment[] = videos.flatMap((v) =>
    v.miniclips
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((c) => ({
        videoPath: v.path,
        videoName: v.name,
        videoId: v.id,
        clipId: c.id,
        start: c.start,
        end: c.end,
        rotation: v.rotation
      }))
  )

  const currentSegment = segments[segmentIndex] ?? null

  // Keep ref in sync with state for use in effects
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  // Load video and seek when segment changes
  useEffect(() => {
    const el = videoRef.current
    if (!el || !currentSegment) return

    const newSrc = `file://${currentSegment.videoPath}`

    const doSeekAndPlay = (): void => {
      el.currentTime = currentSegment.start
      if (isPlayingRef.current) {
        el.play().catch(() => {})
      }
    }

    if (el.src !== newSrc) {
      el.src = newSrc
      el.addEventListener('loadedmetadata', doSeekAndPlay, { once: true })
      el.load()
    } else {
      doSeekAndPlay()
    }
  }, [segmentIndex, currentSegment])

  // Watch for segment end
  useEffect(() => {
    const el = videoRef.current
    if (!el || !currentSegment) return

    const handleTimeUpdate = (): void => {
      if (el.currentTime >= currentSegment.end) {
        if (segmentIndex < segments.length - 1) {
          setSegmentIndex((i) => i + 1)
        } else {
          el.pause()
          setIsPlaying(false)
        }
      }
    }

    el.addEventListener('timeupdate', handleTimeUpdate)
    return () => el.removeEventListener('timeupdate', handleTimeUpdate)
  }, [currentSegment, segmentIndex, segments.length])

  const togglePlay = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      el.play().catch(() => {})
      setIsPlaying(true)
    } else {
      el.pause()
      setIsPlaying(false)
    }
  }, [])

  const handleRestart = useCallback(() => {
    const el = videoRef.current
    if (!el || segments.length === 0) return
    isPlayingRef.current = true
    setIsPlaying(true)
    if (segmentIndex === 0) {
      // Manually trigger since index won't change
      const seg = segments[0]
      const newSrc = `file://${seg.videoPath}`
      if (el.src !== newSrc) {
        el.src = newSrc
        el.addEventListener('loadedmetadata', () => {
          el.currentTime = seg.start
          el.play().catch(() => {})
        }, { once: true })
        el.load()
      } else {
        el.currentTime = seg.start
        el.play().catch(() => {})
      }
    } else {
      setSegmentIndex(0)
    }
  }, [segments, segmentIndex])

  // Spacebar hotkey
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [togglePlay])

  const totalClips = segments.length
  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0)

  if (segments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        No miniclips defined. Go to the editor and press C to create clips.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Clip indicator */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-[#1a1a1a]">
        <div className="text-sm text-gray-300">
          {currentSegment ? (
            <>
              Clip <span className="text-white font-medium">{segmentIndex + 1}</span> of{' '}
              <span className="text-white font-medium">{totalClips}</span>
              <span className="text-gray-500 ml-2">— {currentSegment.videoName}</span>
            </>
          ) : (
            'Preview'
          )}
        </div>
        <div className="text-xs text-gray-500">
          Total: {formatTime(totalDuration)}
        </div>
      </div>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          className="max-w-full max-h-full"
          style={{ transform: `rotate(${currentSegment?.rotation ?? 0}deg)` }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-4 border-t border-white/8">
        <button
          onClick={handleRestart}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded text-sm text-gray-200 transition-colors"
        >
          ↺ Restart
        </button>

        <button
          onClick={togglePlay}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        {/* Segment dots */}
        <div className="flex gap-1 ml-4">
          {segments.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors cursor-pointer ${
                i === segmentIndex ? 'bg-blue-400' : 'bg-white/20 hover:bg-white/40'
              }`}
              onClick={() => {
                isPlayingRef.current = false
                setIsPlaying(false)
                setSegmentIndex(i)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
