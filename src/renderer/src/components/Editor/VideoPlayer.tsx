import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { VideoFile } from '../../types'

interface Props {
  video: VideoFile
  onTimeUpdate: (time: number) => void
  onDurationChange: (duration: number) => void
}

export interface VideoPlayerHandle {
  seek: (time: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  isPlaying: () => boolean
  getCurrentTime: () => number
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  function VideoPlayer({ video, onTimeUpdate, onDurationChange }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const rafRef = useRef<number>(0)
    const playingRef = useRef(false)

    useImperativeHandle(ref, () => ({
      seek: (time) => {
        if (videoRef.current) videoRef.current.currentTime = time
      },
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      toggle: () => {
        const el = videoRef.current
        if (!el) return
        if (el.paused) el.play()
        else el.pause()
      },
      isPlaying: () => !videoRef.current?.paused,
      getCurrentTime: () => videoRef.current?.currentTime ?? 0
    }))

    // RAF loop for smooth time updates
    useEffect(() => {
      const loop = (): void => {
        const el = videoRef.current
        if (el && !el.paused) {
          onTimeUpdate(el.currentTime)
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(rafRef.current)
    }, [onTimeUpdate])

    const handlePlay = (): void => { playingRef.current = true }
    const handlePause = (): void => { playingRef.current = false }
    const handleLoadedMetadata = (): void => {
      if (videoRef.current) {
        onDurationChange(videoRef.current.duration)
        onTimeUpdate(0)
      }
    }

    const rotationStyle: React.CSSProperties = {
      transform: `rotate(${video.rotation}deg)`,
      // When rotating 90/270, swap dimensions
      ...(video.rotation === 90 || video.rotation === 270
        ? { width: '100%', height: 'auto', maxHeight: '100%' }
        : {})
    }

    return (
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          key={video.path}
          src={`file://${video.path}`}
          style={rotationStyle}
          className="max-w-full max-h-full"
          onPlay={handlePlay}
          onPause={handlePause}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={() => {
            if (videoRef.current) onTimeUpdate(videoRef.current.currentTime)
          }}
        />
      </div>
    )
  }
)
