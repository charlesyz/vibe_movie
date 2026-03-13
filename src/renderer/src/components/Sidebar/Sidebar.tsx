import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../../store/store'
import { VideoItem } from './VideoItem'
import type { VideoFile } from '../../types'

export function Sidebar(): JSX.Element {
  const { videos, selectedVideoId, addVideos, removeVideo, reorderVideos, reorderVideosMulti, setSelectedVideoId, clearAll, initFromSaved, setVideoKeyframes } =
    useStore()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleImport = useCallback(async () => {
    setIsImporting(true)
    try {
      const paths = await window.electronAPI.openFileDialog()
      if (paths.length === 0) return

      const newVideos: VideoFile[] = []
      for (const path of paths) {
        try {
          const [meta, thumbnail] = await Promise.all([
            window.electronAPI.getVideoMetadata(path),
            window.electronAPI.getVideoThumbnail(path)
          ])
          newVideos.push({
            id: uuidv4(),
            path,
            name: path.split('/').pop() || path,
            thumbnail,
            duration: meta.duration,
            rotation: 0,
            miniclips: []
          })
        } catch (err) {
          console.error('Failed to load video:', path, err)
        }
      }

      if (newVideos.length > 0) {
        addVideos(newVideos)
        setSelectedVideoId(newVideos[0].id)
        setSelectedIds(new Set([newVideos[0].id]))
        // Load keyframes in background — doesn't block import
        for (const v of newVideos) {
          window.electronAPI.getVideoKeyframes(v.path)
            .then((kf) => setVideoKeyframes(v.id, kf))
            .catch(() => {})
        }
      }
    } finally {
      setIsImporting(false)
    }
  }, [addVideos, setSelectedVideoId])

  const handleClick = useCallback(
    (video: VideoFile, e: React.MouseEvent, index: number) => {
      if (e.metaKey || e.ctrlKey) {
        // Toggle in multi-select
        const next = new Set(selectedIds)
        if (next.has(video.id)) next.delete(video.id)
        else next.add(video.id)
        setSelectedIds(next)
        setSelectedVideoId(video.id)
      } else if (e.shiftKey && selectedVideoId) {
        // Range select
        const currentIdx = videos.findIndex((v) => v.id === selectedVideoId)
        const start = Math.min(currentIdx, index)
        const end = Math.max(currentIdx, index)
        const range = videos.slice(start, end + 1).map((v) => v.id)
        setSelectedIds(new Set(range))
      } else {
        setSelectedIds(new Set([video.id]))
        setSelectedVideoId(video.id)
      }
    },
    [selectedIds, selectedVideoId, videos, setSelectedVideoId]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const overIndex = videos.findIndex((v) => v.id === over.id)

      if (selectedIds.size > 1 && selectedIds.has(String(active.id))) {
        reorderVideosMulti(Array.from(selectedIds), overIndex)
      } else {
        reorderVideos(String(active.id), overIndex)
      }
    },
    [videos, selectedIds, reorderVideos, reorderVideosMulti]
  )

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] border-r border-white/8 w-[220px] shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-white/8 pt-8">
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                     text-white text-xs font-medium rounded-md transition-colors"
        >
          {isImporting ? 'Importing...' : '+ Import Videos'}
        </button>
      </div>

      {/* Video list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {videos.length === 0 ? (
          <p className="text-xs text-gray-500 text-center mt-8 px-4">
            Import MP4 files to get started
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={videos.map((v) => v.id)} strategy={verticalListSortingStrategy}>
              {videos.map((video, index) => (
                <VideoItem
                  key={video.id}
                  video={video}
                  isSelected={selectedVideoId === video.id}
                  isMultiSelected={selectedIds.has(video.id) && selectedVideoId !== video.id}
                  onClick={(e) => handleClick(video, e, index)}
                  onDelete={() => removeVideo(video.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-white/8 space-y-1">
        <button
          onClick={async () => {
            const session = await window.electronAPI.openSessionFile() as { videos?: unknown[] } | null
            if (session?.videos && Array.isArray(session.videos)) {
              initFromSaved(session.videos as never)
            }
          }}
          className="w-full py-1 px-2 text-xs text-gray-400 hover:text-gray-200
                     hover:bg-white/5 rounded transition-colors text-left"
        >
          Load Session...
        </button>
        {videos.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear all videos and clips? This cannot be undone.')) {
                clearAll()
              }
            }}
            className="w-full py-1 px-2 text-xs text-red-500/70 hover:text-red-400
                       hover:bg-red-500/10 rounded transition-colors text-left"
          >
            Clear All
          </button>
        )}
        <p className="text-xs text-gray-600 text-center pt-0.5">
          {videos.length} video{videos.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}
