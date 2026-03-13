// Snap to nearest keyframe at or before time (for clip starts)
export function snapStart(time: number, keyframes: number[]): number {
  if (!keyframes.length) return time
  let result = keyframes[0]
  for (const kf of keyframes) {
    if (kf <= time) result = kf
    else break
  }
  return result
}

// Snap to nearest keyframe at or after time (for clip ends)
export function snapEnd(time: number, keyframes: number[]): number {
  if (!keyframes.length) return time
  for (const kf of keyframes) {
    if (kf >= time) return kf
  }
  return keyframes[keyframes.length - 1]
}
