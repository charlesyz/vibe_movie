import { useRef, useCallback } from 'react'
import type { Miniclip, PendingMiniclip } from '../../types'
import { snapStart, snapEnd } from '../../utils/keyframes'

interface Props {
  duration: number
  currentTime: number
  miniclips: Miniclip[]
  selectedMiniclipId: string | null
  pendingMiniclip: PendingMiniclip | null
  keyframes?: number[]
  onSeek: (time: number) => void
  onSelectMiniclip: (id: string | null) => void
  onUpdateMiniclip: (id: string, updates: Partial<Miniclip>) => void
}

const HANDLE_WIDTH = 8

export function Timeline({
  duration,
  currentTime,
  miniclips,
  selectedMiniclipId,
  pendingMiniclip,
  keyframes = [],
  onSeek,
  onSelectMiniclip,
  onUpdateMiniclip
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  const timeToPct = useCallback(
    (t: number) => (duration > 0 ? (t / duration) * 100 : 0),
    [duration]
  )

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || duration === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      onSeek(pct * duration)
      onSelectMiniclip(null)
    },
    [duration, onSeek, onSelectMiniclip]
  )

  const startHandleDrag = useCallback(
    (
      e: React.PointerEvent,
      clip: Miniclip,
      edge: 'start' | 'end'
    ) => {
      e.stopPropagation()
      e.preventDefault()
      const container = containerRef.current
      if (!container) return

      const onMove = (me: PointerEvent): void => {
        const rect = container.getBoundingClientRect()
        const pct = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width))
        const newTime = pct * duration

        if (edge === 'start') {
          const snapped = snapStart(newTime, keyframes)
          const clamped = Math.max(0, Math.min(snapped, clip.end - 0.1))
          onUpdateMiniclip(clip.id, { start: clamped })
          onSeek(clamped)
        } else {
          const snapped = snapEnd(newTime, keyframes)
          const clamped = Math.min(duration, Math.max(snapped, clip.start + 0.1))
          onUpdateMiniclip(clip.id, { end: clamped })
          onSeek(clamped)
        }
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [duration, onUpdateMiniclip, onSeek]
  )

  const playheadPct = timeToPct(currentTime)

  const pendingEnd = pendingMiniclip ? currentTime : null
  const pendingStartPct = pendingMiniclip ? timeToPct(pendingMiniclip.start) : null
  const pendingEndPct = pendingEnd !== null ? timeToPct(pendingEnd) : null

  return (
    <div className="px-4 pb-4">
      {/* Time display */}
      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Track */}
      <div
        ref={containerRef}
        onClick={handleTrackClick}
        className="relative h-10 bg-white/5 rounded-md cursor-pointer overflow-visible"
      >
        {/* Waveform placeholder */}
        <div className="absolute inset-0 rounded-md bg-gradient-to-r from-white/3 to-white/6" />

        {/* Pending miniclip (pulsing) */}
        {pendingMiniclip && pendingStartPct !== null && pendingEndPct !== null && (
          <div
            className="absolute top-0 h-full bg-yellow-400/40 animate-pulse pointer-events-none"
            style={{
              left: `${Math.min(pendingStartPct, pendingEndPct)}%`,
              width: `${Math.abs(pendingEndPct - pendingStartPct)}%`
            }}
          />
        )}

        {/* Miniclip regions */}
        {miniclips.map((clip) => {
          const left = timeToPct(clip.start)
          const width = timeToPct(clip.end) - left
          const isSelected = clip.id === selectedMiniclipId

          return (
            <div
              key={clip.id}
              className="absolute top-0 h-full"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              {/* Clip body */}
              <div
                className={`
                  absolute inset-0 rounded
                  ${isSelected ? 'bg-blue-500/50 outline outline-1 outline-blue-400' : 'bg-blue-500/30'}
                  transition-colors
                `}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectMiniclip(clip.id)
                }}
              />

              {/* Start handle */}
              <div
                className="absolute top-0 h-full bg-blue-400 rounded-l cursor-ew-resize hover:bg-blue-300 z-10"
                style={{ left: 0, width: HANDLE_WIDTH }}
                onPointerDown={(e) => startHandleDrag(e, clip, 'start')}
                onClick={(e) => e.stopPropagation()}
              />

              {/* End handle */}
              <div
                className="absolute top-0 h-full bg-blue-400 rounded-r cursor-ew-resize hover:bg-blue-300 z-10"
                style={{ right: 0, width: HANDLE_WIDTH }}
                onPointerDown={(e) => startHandleDrag(e, clip, 'end')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80 pointer-events-none z-20"
          style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-2 h-2 bg-white rounded-full -translate-x-[3px] -translate-y-0" />
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}
