import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { generateThumbnail, getVideoMetadata, getKeyframes, exportVideo } from './ffmpeg'

function getStatePath(): string {
  return join(app.getPath('userData'), 'vibe-state.json')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register local file protocol before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
])

app.whenReady().then(() => {
  // Handle local:// protocol — forward Range headers so HTML5 video seeking works
  protocol.handle('local', (req) => {
    const filePath = decodeURIComponent(req.url.slice('local://'.length))
    const fileUrl = 'file://' + filePath

    // Forward Range header so net.fetch handles partial content correctly
    const headers: Record<string, string> = {}
    const range = req.headers.get('range')
    if (range) headers['range'] = range

    return net.fetch(fileUrl, { headers })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC Handlers
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'm4v'] }]
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('video:metadata', async (_event, filePath: string) => {
  return getVideoMetadata(filePath)
})

ipcMain.handle('video:thumbnail', async (_event, filePath: string) => {
  return generateThumbnail(filePath)
})

ipcMain.handle('video:keyframes', async (_event, filePath: string) => {
  return getKeyframes(filePath)
})

ipcMain.handle('dialog:saveFile', async () => {
  const result = await dialog.showSaveDialog({
    defaultPath: 'vibe-movie-export.mp4',
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle(
  'export:video',
  async (
    event,
    clips: Array<{ videoPath: string; start: number; end: number; rotation: number }>,
    outputPath: string
  ) => {
    await exportVideo(clips, outputPath, (pct) => {
      event.sender.send('export:progress', pct)
    })
  }
)

ipcMain.handle('state:save', (_event, state: unknown) => {
  writeFileSync(getStatePath(), JSON.stringify(state), 'utf-8')
})

ipcMain.handle('state:load', () => {
  const p = getStatePath()
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
})

ipcMain.handle('session:saveFile', (_event, state: unknown, filePath: string) => {
  writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
})

ipcMain.handle('session:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Vibe Movie Session', extensions: ['json'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  try {
    return JSON.parse(readFileSync(result.filePaths[0], 'utf-8'))
  } catch {
    return null
  }
})
