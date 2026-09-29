export type RadarFrame = { time: string; tileUrl: string };

export type RadarManifest = {
  provider: "rainviewer" | "none";
  stale?: boolean;
  generatedAt?: string;
  frames: RadarFrame[];
  satellite: RadarFrame[];
  maxZoom: number;
  attribution: { text: string; url: string };
};
