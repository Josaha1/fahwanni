/**
 * Wraps text to lines no wider than maxWidth. Thai has no spaces between words, so break
 * points come from Intl.Segmenter word boundaries; a single segment wider than a line is
 * split by character as a last resort.
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, locale = "th"): string[] {
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const { segment } of segmenter.segment(paragraph)) {
      if (measure(line + segment) <= maxWidth) { line += segment; continue; }
      if (line.trim()) lines.push(line.trimEnd());
      line = segment.trimStart();
      while (measure(line) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line.trim() || lines.length === 0) lines.push(line.trimEnd());
  }
  return lines;
}
