export function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 4,
  }).format(value);
}

export function formatCompactNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value?: number | null, scale = 1) {
  if (value == null || Number.isNaN(value)) return "Unavailable";
  return `${value > 0 ? "+" : ""}${(value * scale).toFixed(2)}%`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
