import { provinceEmbedData } from "@/components/share/embed-data";
import { GET as getWarnings } from "@/app/api/tmd-warnings/route";
import type { TmdWarnings } from "@/lib/tmd";
import { textPage } from "@/lib/text-page";

export async function GET(request: Request) {
  // Query language keeps the shared CDN cache independent of a viewer's cookies.
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "th";
  const [{ dams, flood }, warnings] = await Promise.all([
    provinceEmbedData(),
    getWarnings().then(async (response) => {
      const payload = await response.json() as TmdWarnings & { error?: string };
      return payload.error ? null : payload;
    }).catch(() => null),
  ]);
  return new Response(textPage({ dams, flood, warnings, checkedAt: new Date().toISOString() }, locale), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=600" },
  });
}
