import { useT } from "@/i18n/client";

export function ActionRail({ onLayers, terrainOk, terrainOn, onTerrain }: {
  onLayers: () => void;
  terrainOk: boolean;
  terrainOn: boolean;
  onTerrain: () => void;
}) {
  const t = useT();
  const terrainLabel = terrainOn ? t("ปิดแผนที่ 3 มิติ") : t("เปิดแผนที่ 3 มิติ");
  return (
    <div className="map-action-rail">
      <button type="button" className="map-icon-btn" onClick={onLayers} aria-label={t("ชั้นข้อมูล")} title={t("ชั้นข้อมูล")}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      </button>
      {terrainOk && <button type="button" className="map-icon-btn text-sm font-semibold" onClick={onTerrain}
        aria-pressed={terrainOn} aria-label={terrainLabel} title={terrainLabel}>3D</button>}
    </div>
  );
}
