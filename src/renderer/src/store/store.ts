import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { VideoFile, Miniclip, PendingMiniclip, Rotation } from '../types'

interface AppState {
  videos: VideoFile[]
  selectedVideoId: string | null
  selectedMiniclipId: string | null
  pendingMiniclip: PendingMiniclip | null
  view: 'editor' | 'preview'

  addVideos: (videos: VideoFile[]) => void
  removeVideo: (id: string) => void
  reorderVideos: (activeId: string, overIndex: number) => void
  reorderVideosMulti: (ids: string[], overIndex: number) => void
  setSelectedVideoId: (id: string | null) => void
  rotateVideo: (videoId: string) => void
  startMiniclip: (videoId: string, start: number) => void
  stopMiniclip: (videoId: string, end: number) => void
  cancelPendingMiniclip: () => void
  updateMiniclip: (videoId: string, clipId: string, updates: Partial<Miniclip>) => void
  deleteMiniclip: (videoId: string, clipId: string) => void
  setSelectedMiniclipId: (id: string | null) => void
  setView: (view: 'editor' | 'preview') => void
  clearAll: () => void
  initFromSaved: (videos: VideoFile[]) => void
  setVideoKeyframes: (videoId: string, keyframes: number[]) => void
}

export const useStore = create<AppState>((set, get) => ({
  videos: [],
  selectedVideoId: null,
  selectedMiniclipId: null,
  pendingMiniclip: null,
  view: 'editor',

  addVideos: (newVideos) =>
    set((state) => ({
      videos: [...state.videos, ...newVideos]
    })),

  removeVideo: (id) =>
    set((state) => {
      const videos = state.videos.filter((v) => v.id !== id)
      const selectedVideoId =
        state.selectedVideoId === id
          ? (videos[0]?.id ?? null)
          : state.selectedVideoId
      return { videos, selectedVideoId, pendingMiniclip: null }
    }),

  reorderVideos: (activeId, overIndex) =>
    set((state) => {
      const videos = [...state.videos]
      const fromIndex = videos.findIndex((v) => v.id === activeId)
      if (fromIndex === -1) return state
      const [item] = videos.splice(fromIndex, 1)
      videos.splice(overIndex, 0, item)
      return { videos }
    }),

  reorderVideosMulti: (ids, overIndex) =>
    set((state) => {
      const videos = [...state.videos]
      const moving = ids.map((id) => videos.find((v) => v.id === id)).filter(Boolean) as VideoFile[]
      const remaining = videos.filter((v) => !ids.includes(v.id))
      const insertAt = Math.min(overIndex, remaining.length)
      remaining.splice(insertAt, 0, ...moving)
      return { videos: remaining }
    }),

  setSelectedVideoId: (id) =>
    set({
      selectedVideoId: id,
      pendingMiniclip: null,
      selectedMiniclipId: null
    }),

  rotateVideo: (videoId) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === videoId ? { ...v, rotation: ((v.rotation + 90) % 360) as Rotation } : v
      )
    })),

  startMiniclip: (videoId, start) => {
    const state = get()
    const video = state.videos.find((v) => v.id === videoId)
    if (!video) return
    set({ pendingMiniclip: { id: uuidv4(), start } })
  },

  stopMiniclip: (videoId, end) => {
    const state = get()
    if (!state.pendingMiniclip) return
    const { id, start } = state.pendingMiniclip
    if (end - start < 0.1) {
      set({ pendingMiniclip: null })
      return
    }
    const clip: Miniclip = { id, start, end }
    set((s) => ({
      videos: s.videos.map((v) =>
        v.id === videoId ? { ...v, miniclips: [...v.miniclips, clip] } : v
      ),
      pendingMiniclip: null,
      selectedMiniclipId: id
    }))
  },

  cancelPendingMiniclip: () => set({ pendingMiniclip: null }),

  updateMiniclip: (videoId, clipId, updates) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === videoId
          ? {
              ...v,
              miniclips: v.miniclips.map((c) => (c.id === clipId ? { ...c, ...updates } : c))
            }
          : v
      )
    })),

  deleteMiniclip: (videoId, clipId) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === videoId ? { ...v, miniclips: v.miniclips.filter((c) => c.id !== clipId) } : v
      ),
      selectedMiniclipId:
        state.selectedMiniclipId === clipId ? null : state.selectedMiniclipId
    })),

  setSelectedMiniclipId: (id) => set({ selectedMiniclipId: id }),

  setView: (view) => set({ view }),

  clearAll: () =>
    set({ videos: [], selectedVideoId: null, selectedMiniclipId: null, pendingMiniclip: null }),

  initFromSaved: (videos) =>
    set({ videos, selectedVideoId: videos[0]?.id ?? null }),

  setVideoKeyframes: (videoId, keyframes) =>
    set((state) => ({
      videos: state.videos.map((v) => v.id === videoId ? { ...v, keyframes } : v)
    }))
}))
