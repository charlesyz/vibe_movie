# Vibe Movie — Agent Guide

## Stack
- **Electron 35** + **React 19** + **TypeScript** + **Vite** (via `electron-vite`)
- **Tailwind CSS 4** (`@tailwindcss/vite` plugin, not PostCSS)
- **Zustand** for state, **@dnd-kit** for drag-and-drop
- **ffmpeg-static** + **ffprobe-static** for all video processing

## Running the app
```bash
npm run dev       # dev server + Electron window (hot-reloads renderer)
npm run build     # production build to out/
```

Node/npm are at `/usr/local/bin/` — always use full path or ensure it's on PATH.

## Project structure
```
electron/
  main.ts          # IPC handlers, local:// protocol, window setup
  ffmpeg.ts        # All FFmpeg/FFprobe subprocess logic
src/
  preload/
    index.ts       # contextBridge → window.electronAPI
  renderer/
    index.html
    src/
      main.tsx         # Entry point, loads persisted state before render
      App.tsx          # Layout: Sidebar + Editor/Preview tabs + Export button
      electron.d.ts    # Types for window.electronAPI
      assets/main.css  # @import "tailwindcss"
      types/index.ts   # Shared types (VideoFile, Miniclip, etc.)
      store/store.ts   # Zustand store
      utils/keyframes.ts  # snapStart / snapEnd helpers
      components/
        Sidebar/       # Video list, drag-reorder, multi-select, import
        Editor/        # VideoPlayer, Timeline, hotkeys
        Preview/       # Sequential clip playback
        ExportModal.tsx
```

## Architecture rules

### Hot-reload vs restart
- **Renderer files** (`src/renderer/`): hot-reload, no restart needed
- **Main process files** (`electron/`, `src/preload/`): require `npm run dev` restart

### IPC pattern
All main↔renderer communication goes through `electron/main.ts` (ipcMain.handle) → `src/preload/index.ts` (contextBridge) → `src/renderer/src/electron.d.ts` (types). Adding a new IPC call requires changes to all three files.

### Local video protocol
Videos are served via a custom `local://` scheme registered in `main.ts`. It forwards HTTP Range headers so HTML5 video seeking works. Use `file://${path}` in the renderer (webSecurity is disabled).

### Video file security
`webSecurity: false` is set intentionally — this is a local desktop app with no web content.

## FFmpeg

### Binary resolution
`ffmpeg-static` and `ffprobe-static` are resolved at runtime. In packaged builds, paths replace `app.asar` → `app.asar.unpacked` (see `resolveBinary()` in `ffmpeg.ts`). The `asarUnpack` field in `package.json` build config is required.

### Export pipeline
Two paths based on whether any clip has rotation:

**No rotation (fast path):**
1. Per-segment stream copy with `-ss {start} -to {end} -c copy -avoid_negative_ts make_zero` in parallel (max 4 workers)
2. Concat temp files with `-f concat -c copy`
- Cuts are keyframe-accurate: start rounds BACK to previous keyframe, end rounds FORWARD to next keyframe

**With rotation:**
1. Re-encode per segment with `h264_videotoolbox` (hardware) → fallback to `libx264 -preset ultrafast`
2. Concat temp files

### Export debugging
Logs are written to `/tmp/vibe-movie-export.log` with timestamps. Check this file if export hangs.

### Known issues / gotchas
- **`-movflags +faststart` causes hangs** on large files with `-c copy` — do not add it back
- **VideoToolbox** requires native macOS (not VM). `kern.hv_vmm_present failed` warning from FFmpeg is harmless noise, not an error
- **stdout must be drained** in any FFmpeg process or the pipe buffer fills and deadlocks. Both `runFFmpeg` and `runFFmpegWithProgress` drain the unused pipe
- **Parallel encoding** uses a work-queue pattern (not `Promise.all` on all clips) to cap concurrency at 4

## State & persistence

### Zustand store (`store/store.ts`)
Key state: `videos[]`, `selectedVideoId`, `selectedMiniclipId`, `pendingMiniclip`, `view`.

`VideoFile` includes `keyframes?: number[]` which is loaded async after import and used for snapping clip boundaries to keyframe positions.

### Auto-save
`main.tsx` subscribes to store changes and debounces a save (1s) to `app.getPath('userData')/vibe-state.json`. State is loaded before first render in `init()`.

### Session sidecar
On export, a `.json` file is written alongside the MP4 (same name, `.json` extension) containing the full `videos` array. This happens **before** the export starts so progress is preserved even if export fails. The sidebar "Load Session..." button can load these files back.

## Keyframe snapping
- `snapStart(time, keyframes)` → nearest keyframe ≤ time (rounds back)
- `snapEnd(time, keyframes)` → nearest keyframe ≥ time (rounds forward)
- Applied in `Editor.tsx` on `c` keypress and in `Timeline.tsx` on handle drag
- Matches export behavior (stream copy always cuts at keyframes)
- Keyframes load async after import; no snapping until loaded (graceful fallback)

## TypeScript
Strict mode. Two tsconfig roots:
- `tsconfig.node.json` — covers `electron/` and `electron.vite.config.ts`
- `tsconfig.web.json` — covers `src/renderer/` and `src/preload/`

Run `npm run build` to type-check (no separate tsc --noEmit script).
