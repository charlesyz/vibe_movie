export interface ElectronAPI {
  openFileDialog: () => Promise<string[]>
  getVideoMetadata: (filePath: string) => Promise<{ duration: number; width: number; height: number }>
  getVideoThumbnail: (filePath: string) => Promise<string>
  getVideoKeyframes: (filePath: string) => Promise<number[]>
  saveFileDialog: () => Promise<string | null>
  exportVideo: (
    clips: Array<{ videoPath: string; start: number; end: number; rotation: number }>,
    outputPath: string
  ) => Promise<void>
  onExportProgress: (callback: (pct: number) => void) => () => void
  saveState: (state: unknown) => Promise<void>
  loadState: () => Promise<unknown>
  saveSessionFile: (state: unknown, filePath: string) => Promise<void>
  openSessionFile: () => Promise<unknown>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
