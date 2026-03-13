# Vibe Movie

A lightweight MacOS video editing app for creating jump-cut compilations from MP4 files.

## Features

- Import MP4/MOV/MKV video files into a reorderable sidebar
- Drag to reorder, multi-select with Cmd/Shift+click
- Define **miniclips** (sub-regions) per video using hotkeys or timeline handles
- Preview the final cut across all clips in order
- Export to MP4 — keyframe-accurate stream copy (fast) with hardware rotation via VideoToolbox
- Session auto-save and JSON sidecar export for restoring work

## Running

```bash
npm install
npm run dev
```

## Hotkeys (Editor)

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `←` / `→` | Seek ±2s |
| `Shift+←` / `Shift+→` | Seek ±5s |
| `↑` / `↓` | Previous / next video |
| `C` | Start / stop miniclip |
| `Backspace` | Delete selected miniclip |
| `Esc` | Cancel pending miniclip |

---

## Original Spec

You are building an app called "Vibe Movie". It should be a very simple, lightweight, and minimal video editing application that runs on MacOS. The app is very simple, and only supports a small number of actions

1. Read video files and add to file list. Most of the input videos will be mp4. File list is displayed on a left sidebar as icons with video names
2. Reorganize files within the side bar to change their master order. User should be able to reorganize files by dragging, or multi-selecting then dragging.
3. Clicking on a file in the sidebar lets you edit that specific video. There are only two operations allowed when editing a video: rotate by 90 degrees, and select "miniclips" from each video as regions of interest (more on this later)
4. Aggregate all selected miniclips together by splicing them together based on the master order specified in the sidebar. Clips should be connected with jump cuts, no transitions.
5. Preview the final video created by slicing miniclips together. The user should be able to make any edits necessary and quickly iterate on the final product
6. Export the final video to disk in mp4 format.

### Video Editing Workflow

Upon clicking on a video in the sidebar, open an editing window in the main view. The view should include a video preview with a timeline of the video below. The user should be able to click in the timeline to jump to specific parts of the video.

Hotkeys:
- left arrow / right arrow: fast scrobble in the corresponding direction
- spacebar: play / pause
- down arrow: go to the next video in the sidebar
- up arrow: go to the previous video in the sidebar
- 'c': start / stop a miniclip. Miniclips are selected sub-sections of a video that will be kept for aggregation. The rest of the video will be dropped. Miniclip sections should be highlighted in the timeline and the boundaries of it should be resizable by dragging
- 'backspace': delete the selected miniclip
