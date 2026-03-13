export type Rotation = 0 | 90 | 180 | 270

export interface Miniclip {
  id: string
  start: number
  end: number
}

export interface PendingMiniclip {
  id: string
  start: number
}

export interface VideoFile {
  id: string
  path: string
  name: string
  thumbnail: string
  duration: number
  rotation: Rotation
  miniclips: Miniclip[]
  keyframes?: number[]
}

export interface ExportClip {
  videoPath: string
  start: number
  end: number
  rotation: Rotation
}
