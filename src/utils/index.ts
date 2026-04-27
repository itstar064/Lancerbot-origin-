export const delay = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const isEmpty = (value: any): boolean => {
  if (value == null) return true; // null or undefined

  if (typeof value === "string" || Array.isArray(value)) {
    return value.length === 0;
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
};

export function getRndId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

/**
 * Largest yen amount implied by Lancers search-card 報酬 text (e.g. "200,000", "10万~30万").
 * Used to filter Telegram alerts without skipping DB deduplication.
 */
export function parseLancersPriceMaxYen(price: string): number | null {
  if (!price || !String(price).trim()) return null;
  const normalized = String(price)
    .replace(/[～〜–—]/g, "~")
    .replace(/\s/g, "")
    .trim();

  const values: number[] = [];
  const manRegex = /(\d+(?:\.\d+)?)万/g;
  let m: RegExpExecArray | null;
  while ((m = manRegex.exec(normalized)) !== null) {
    values.push(Math.round(parseFloat(m[1]) * 10_000));
  }

  const rest = normalized.replace(/(\d+(?:\.\d+)?)万/g, "");
  const numMatches = rest.match(/\d{1,3}(?:,\d{3})+|\d+/g);
  if (numMatches) {
    for (const raw of numMatches) {
      const n = parseInt(raw.replace(/,/g, ""), 10);
      if (!Number.isNaN(n)) values.push(n);
    }
  }

  if (values.length === 0) return null;
  return Math.max(...values);
}

export function meetsMinTelegramReportYen(
  price: string,
  minYen: number,
): boolean {
  const maxYen = parseLancersPriceMaxYen(price);
  if (maxYen == null) return false;
  return maxYen >= minYen;
}
