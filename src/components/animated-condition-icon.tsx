"use client";

import { useState } from "react";
import { animSheet, iconUrl } from "@/lib/condition";

interface Props {
  conditionType?: string;
  isDaytime?: boolean;
  /** Google icon base, used when data saver is on or the sheet fails to load. */
  iconBaseUri?: string;
  dark: boolean;
  label: string;
  size?: number;
}

/**
 * Looping clay icon rendered with Blender (scripts/blender). Reduced motion shows the first
 * frame (CSS); data saver uses Google's small SVG instead of the ~60 KB sheet.
 */
export function AnimatedConditionIcon({ conditionType, isDaytime, iconBaseUri, dark, label, size = 88 }: Props) {
  const [saveData] = useState(() => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false);
  const [failed, setFailed] = useState(false);
  const sheet = animSheet(conditionType, isDaytime);

  if ((saveData || failed) && iconBaseUri) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={iconUrl(iconBaseUri, dark)} alt={label} width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <div role="img" aria-label={label} className="anim-icon shrink-0" style={{ width: size, height: size, backgroundImage: `url(${sheet})` }}>
      {/* Hidden probe so a missing sheet falls back to the SVG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sheet} alt="" hidden onError={() => setFailed(true)} />
    </div>
  );
}
