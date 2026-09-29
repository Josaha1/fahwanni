import { useT } from "@/i18n/client";

export function ActionRail({ compact, onLayers, layersButton, terrainOk, terrainOn, onTerrain, immersive, onFullscreen, onShare, onShareImage, makingImage, onShortcuts, shortcutsButton }: {
  /** Phones: the layers dialog holds map and sharing controls. */
  compact: boolean;
  onLayers: () => void;
  layersButton: (element: HTMLButtonElement | null) => void;
  terrainOk: boolean;
  terrainOn: boolean;
  onTerrain: () => void;
  immersive: boolean;
  onFullscreen: () => void;
  onShare: () => void;
  onShareImage: () => void;
  makingImage: boolean;
  onShortcuts: () => void;
  shortcutsButton: (element: HTMLButtonElement | null) => void;
}) {
  const t = useT();
  const terrainLabel = terrainOn ? t("ปิดแผนที่ 3 มิติ") : t("เปิดแผนที่ 3 มิติ");
  const fullscreenLabel = immersive ? t("ออกจากเต็มจอ") : t("เต็มจอ");
  return (
    <div className="map-action-rail">
      <button ref={layersButton} type="button" className="map-icon-btn" onClick={onLayers} aria-label={t("ชั้นข้อมูล")} title={t("ชั้นข้อมูล")} aria-haspopup="dialog" aria-controls="map-layers-dialog">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      </button>
      {!compact && terrainOk && <button type="button" className="map-icon-btn text-sm font-semibold" onClick={onTerrain}
        aria-pressed={terrainOn} aria-label={terrainLabel} title={terrainLabel}>3D</button>}
      {!compact && <>
        <button ref={shortcutsButton} type="button" className="map-icon-btn" onClick={onShortcuts} aria-label={t("ปุ่มลัด")} title={t("ปุ่มลัด")}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M7 15h10" />
          </svg>
        </button>
        <button type="button" className="map-icon-btn" onClick={onFullscreen} aria-pressed={immersive} aria-label={fullscreenLabel} title={fullscreenLabel}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {immersive ? <><path d="M9 3v6H3M15 3v6h6M3 15h6v6M21 15h-6v6" /></> : <><path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6" /></>}
          </svg>
        </button>
        <button type="button" className="map-icon-btn" onClick={onShare} aria-label={t("แชร์มุมมองนี้")} title={t("แชร์มุมมองนี้")}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" />
          </svg>
        </button>
        <button type="button" className="map-icon-btn disabled:opacity-60" onClick={onShareImage} disabled={makingImage}
          aria-label={t("แชร์ภาพแผนที่")} title={t("แชร์ภาพแผนที่")}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m3 17 5-5 4 4 3-3 6 6" />
          </svg>
        </button>
      </>}
    </div>
  );
}
