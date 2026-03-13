import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { VideoFile } from '../../types'

interface Props {
  video: VideoFile
  isSelected: boolean
  isMultiSelected: boolean
  onClick: (e: React.MouseEvent) => void
  onDelete: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoItem({ video, isSelected, isMultiSelected, onClick, onDelete }: Props): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  const clipCount = video.miniclips.length

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        group flex items-center gap-2 p-2 rounded-lg cursor-pointer select-none
        transition-colors duration-100
        ${isSelected ? 'bg-blue-600' : isMultiSelected ? 'bg-blue-900/60' : 'hover:bg-white/5'}
      `}
    >
      {/* Thumbnail */}
      <div className="w-14 h-10 rounded overflow-hidden shrink-0 bg-black/40 flex items-center justify-center">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="text-xs text-gray-500">...</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-gray-100">{video.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs text-gray-400">{formatDuration(video.duration)}</span>
          {clipCount > 0 && (
            <span className="text-xs bg-blue-500/30 text-blue-300 px-1 rounded">
              {clipCount} clip{clipCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Delete button — visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/30
                   text-gray-500 hover:text-red-400 transition-all shrink-0"
        title="Remove from list"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
