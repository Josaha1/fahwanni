import manifest from "../../../public/manifest.json";

export function GET() {
  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" },
  });
}
