/**
 * Windy Webcams API v3 (free key, x-windy-api-key). Terms: show images only via the URLs the API returns, link each image to
 * its webcam page, credit "Windy.com", image URLs expire after ~10 minutes, use the data as is (no image caching).
 */
export interface Webcam { id: string; title: string; city: string; lat: number; lon: number; image: string; page: string; updatedAt: string | null }

type Raw = { webcamId?: number | string; title?: string; status?: string; lastUpdatedOn?: string;
  location?: { city?: string; latitude?: number; longitude?: number };
  images?: { current?: { preview?: string; thumbnail?: string } }; urls?: { detail?: string } };

export function parseWebcams(json: { webcams?: Raw[] }): Webcam[] {
  return (json.webcams ?? []).flatMap((cam) => {
    const image = cam.images?.current?.preview ?? cam.images?.current?.thumbnail;
    const page = cam.urls?.detail;
    const lat = cam.location?.latitude, lon = cam.location?.longitude;
    if (cam.status && cam.status !== "active") return [];
    if (!cam.webcamId || !image || !page || !/^https:\/\//.test(image) || !/^https:\/\//.test(page) || typeof lat !== "number" || typeof lon !== "number") return [];
    return [{ id: String(cam.webcamId), title: cam.title ?? "", city: cam.location?.city ?? "", lat, lon, image, page, updatedAt: cam.lastUpdatedOn ?? null }];
  });
}

export function webcamsUrl(lat: number, lon: number, radiusKm = 50, limit = 6) {
  return `https://api.windy.com/webcams/api/v3/webcams?nearby=${lat.toFixed(3)},${lon.toFixed(3)},${radiusKm}&limit=${limit}&include=images,location,urls`;
}
