import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles'),

  getVideoMetadata: (
    filePath: string
  ): Promise<{ duration: number; width: number; height: number }> =>
    ipcRenderer.invoke('video:metadata', filePath),

  getVideoThumbnail: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('video:thumbnail', filePath),

  getVideoKeyframes: (filePath: string): Promise<number[]> =>
    ipcRenderer.invoke('video:keyframes', filePath),

  saveFileDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:saveFile'),

  exportVideo: (
    clips: Array<{ videoPath: string; start: number; end: number; rotation: number }>,
    outputPath: string
  ): Promise<void> => ipcRenderer.invoke('export:video', clips, outputPath),

  onExportProgress: (callback: (pct: number) => void): (() => void) => {
    const handler = (_: unknown, pct: number): void => callback(pct)
    ipcRenderer.on('export:progress', handler)
    return () => ipcRenderer.removeListener('export:progress', handler)
  },

  // Persistence
  saveState: (state: unknown): Promise<void> => ipcRenderer.invoke('state:save', state),
  loadState: (): Promise<unknown> => ipcRenderer.invoke('state:load'),

  // Session files (sidecar + manual load)
  saveSessionFile: (state: unknown, filePath: string): Promise<void> =>
    ipcRenderer.invoke('session:saveFile', state, filePath),
  openSessionFile: (): Promise<unknown> => ipcRenderer.invoke('session:openFile')
})
