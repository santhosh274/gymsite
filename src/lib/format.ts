export const INR = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const daysBetween = (a: string | Date, b: string | Date = new Date()) => {
  const d1 = typeof a === "string" ? new Date(a) : a;
  const d2 = typeof b === "string" ? new Date(b) : b;
  return Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
};
