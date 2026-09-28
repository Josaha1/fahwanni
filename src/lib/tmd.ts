export type TmdWarning = { title: string; description: string; announcedAt?: string; url?: string };
export type TmdWarnings = { items: TmdWarning[] };

function content(xml: string, names: string[]): string | undefined {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, "i"));
    if (match) return match[1];
  }
  return undefined;
}

function value(xml: string, names: string[]): string | undefined {
  const raw = content(xml, names)?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "").replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (entity, number: string | undefined, named: string | undefined) => {
      if (number) {
        const code = Number.parseInt(number.slice(number[0].toLowerCase() === "x" ? 1 : 0), number[0].toLowerCase() === "x" ? 16 : 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[named?.toLowerCase() ?? ""] ?? entity;
    }).trim();
  return raw || undefined;
}

export function parseTmdWarnings(xml: string): TmdWarnings {
  const warnings = content(xml, ["Warnings"]);
  if (!warnings) return { items: [] };

  const items: TmdWarning[] = [];
  for (const match of warnings.matchAll(/<(Warning|item)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
    const body = match[2];
    const title = value(body, ["title"]);
    const description = value(body, ["description"]);
    if (!title || !description) continue;
    const announcedAt = value(body, ["announcedAt", "pubDate", "date"]);
    const uri = value(body, ["url", "uri", "link"]);
    const url = uri && /^https?:\/\//i.test(uri) ? uri : undefined;
    items.push({ title, description, ...(announcedAt ? { announcedAt } : {}), ...(url ? { url } : {}) });
  }
  return { items };
}
