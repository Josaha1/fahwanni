export type Place = {
  id: string;
  name: string;
  admin?: string;
  country?: string;
  lat: number;
  lon: number;
  source: "province" | "search" | "gps";
};
