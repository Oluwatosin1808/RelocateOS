/**
 * Salary parsing and period normalisation.
 * Preserve the original text; only produce monthly-EUR equivalents when the
 * currency and period are unambiguous. Never guess an amount.
 */

export type ParsedSalary = {
  raw: string;
  min: number | null;
  max: number | null;
  currency: string | null;
  period: "monthly" | "annual" | "daily" | "hourly" | "unknown";
  monthlyEurMin: number | null;
  monthlyEurMax: number | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  $: "USD",
  "£": "GBP",
};

/** Static planning rates used ONLY for display filtering; labelled as assumptions. */
const EUR_PER_UNIT: Record<string, number> = {
  EUR: 1,
  USD: 1.08, // documented approximation; filter-only, never immigration math
  GBP: 1.17,
};

const PERIOD_PATTERNS: { re: RegExp; period: ParsedSalary["period"]; perYear: number }[] = [
  { re: /per\s*year|\/\s*year|yearly|annum|p\.?a\.?|annual/i, period: "annual", perYear: 12 },
  { re: /per\s*month|\/\s*month|monthly|p\.?m\.?/i, period: "monthly", perYear: 1 },
  { re: /per\s*day|\/\s*day|daily|day rate/i, period: "daily", perYear: 220 },
  { re: /per\s*hour|\/\s*hour|hourly|\/hr|hour/i, period: "hourly", perYear: 1720 },
];

function parseNumber(token: string): number | null {
  const cleaned = token.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  // 1.234,56 (EU) vs 1,234.56 (US) vs 1.234 (EU thousands) vs 1234
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalised = cleaned;
  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalised = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalised = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && (parts[1]?.length ?? 0) <= 2) {
      normalised = cleaned.replace(",", ".");
    } else {
      normalised = cleaned.replace(/,/g, "");
    }
  } else if (hasDot) {
    const parts = cleaned.split(".");
    if (parts.length > 2 || (parts.length === 2 && (parts[1]?.length ?? 0) === 3)) {
      // 1.234.567 or 4.500 → thousands separator
      normalised = cleaned.replace(/\./g, "");
    }
  }
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

export function detectCurrency(text: string): string | null {
  if (/€|EUR/i.test(text)) return "EUR";
  if (/\$|USD/i.test(text)) return "USD";
  if (/£|GBP/i.test(text)) return "GBP";
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(sym)) return code;
  }
  return null;
}

function detectPeriod(text: string): ParsedSalary["period"] {
  for (const p of PERIOD_PATTERNS) {
    if (p.re.test(text)) return p.period;
  }
  return "unknown";
}

export function parseSalary(raw: string): ParsedSalary {
  const empty: ParsedSalary = {
    raw,
    min: null,
    max: null,
    currency: null,
    period: "unknown",
    monthlyEurMin: null,
    monthlyEurMax: null,
  };
  if (!raw.trim()) return empty;

  const currency = detectCurrency(raw);
  const period = detectPeriod(raw);

  // Range: "€3,000 – €4,500" | "€3000-4500" | "between €3k and €4k"
  const rangeMatch = raw.match(
    /(?:€|EUR|£|GBP|\$|USD)?\s*([\d.,]+)\s*(?:k|K)?\s*(?:-|–|—|to|and)\s*(?:€|EUR|£|GBP|\$|USD)?\s*([\d.,]+)\s*(?:k|K)?/,
  );
  let min: number | null = null;
  let max: number | null = null;

  if (rangeMatch) {
    min = parseNumber(rangeMatch[1] ?? "");
    max = parseNumber(rangeMatch[2] ?? "");
    if (/[kK]\s*(?:-|–|—|to|and)|\s(?:to|and)\s[\d.,]+\s*[kK]|\b([\d.,]+)k\s*[-–—]/.test(raw)) {
      if (min !== null && min < 1000) min *= 1000;
      if (max !== null && max < 1000) max *= 1000;
    }
  } else {
    const single = raw.match(/(?:€|EUR|£|GBP|\$|USD)?\s*([\d.,]+)\s*(?:k|K)?/);
    if (single) {
      min = parseNumber(single[1] ?? "");
      max = min;
      if (single[0]?.includes("k") || single[0]?.includes("K")) {
        if (min !== null && min < 1000) {
          min *= 1000;
          if (max !== null) max *= 1000;
        }
      }
    }
  }

  if (min === null && max === null) return empty;

  let monthlyEurMin: number | null = null;
  let monthlyEurMax: number | null = null;
  const perYear =
    PERIOD_PATTERNS.find((p) => p.period === period)?.perYear ?? null;
  const fx = currency ? EUR_PER_UNIT[currency] : null;

  if (perYear && fx && min !== null) {
    monthlyEurMin = Math.round((min / perYear) * fx);
  }
  if (perYear && fx && max !== null) {
    monthlyEurMax = Math.round((max / perYear) * fx);
  }

  return {
    raw,
    min,
    max,
    currency,
    period,
    monthlyEurMin,
    monthlyEurMax,
  };
}
