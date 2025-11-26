export function formatTopicLabel(slug: string): string {
  if (!slug) return "";

  const cleaned = slug.replace(/[_-]+/g, " ").trim();
  const lowerWords = new Set(["and", "of", "for", "the", "in", "on", "at", "to"]);

  const words = cleaned.split(/\s+/);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && lowerWords.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function formatHitLabel(key: string, value: unknown): string {
  const label = formatTopicLabel(key);

  let count: number | undefined;
  if (typeof value === "number") {
    count = value;
  } else if (value && typeof value === "object") {
    try {
      const numericValues = Object.values(value as Record<string, unknown>).filter(
        (v) => typeof v === "number"
      ) as number[];
      if (numericValues.length > 0) {
        count = numericValues.reduce((sum, v) => sum + v, 0);
      }
    } catch {
      // ignore and fall back to label only
    }
  }

  return count !== undefined ? `${label} (${count})` : label;
}


