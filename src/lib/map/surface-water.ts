export function surfaceWaterTileUrl(tms: { z: number | string; y: number | string; x: number | string }): string {
  return `https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/${tms.z}/${tms.x}/${tms.y}.png`;
}
