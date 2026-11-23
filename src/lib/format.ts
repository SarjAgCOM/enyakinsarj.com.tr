const nf = new Intl.NumberFormat("tr-TR");
const money = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
export const fmtTl = (n: number | null | undefined) => (n == null ? "—" : `${money.format(n)} ₺`);
export const fmtKw = (n: number | null | undefined) => (n == null ? "—" : `${nf.format(Math.round(n))} kW`);
export const fmtDate = (d: Date | string | null | undefined) => (d ? dateFmt.format(new Date(d)) : "—");
export const fmtDateTime = (d: Date | string | null | undefined) => (d ? dateTimeFmt.format(new Date(d)) : "—");
export const monthYear = () =>
  new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date());

/** Ortalama tüketim (kWh/100 km) — 100 km maliyet hesaplarında kullanılır. */
export const AVG_KWH_PER_100KM = 17;
export const costPer100Km = (pricePerKwh: number | null | undefined) =>
  pricePerKwh == null ? null : Math.round(pricePerKwh * AVG_KWH_PER_100KM);

export const STANDARD_LABELS: Record<string, string> = {
  CCS2: "CCS (DC)",
  CCS: "CCS (DC)",
  CCS1: "CCS1 (DC)",
  TYPE2: "Type 2 (AC)",
  CHADEMO: "CHAdeMO (DC)",
  TYPE1: "Type 1 (AC)",
  GBT: "GB/T",
  NACS: "NACS",
  SCHUKO: "Schuko",
};
/**
 * Bazı ağlar liste verisinde güç ve soket ayrıntısı paylaşmaz. Bu durumda DC istasyon sayısı 0 değil,
 * "bilinmiyor"dur; arayüzde ve llms.txt içinde 0 olarak yazılmamalıdır.
 */
export const hasPowerData = (p: { dcStationCount: number; maxPowerKw: number | null }) =>
  p.maxPowerKw != null || p.dcStationCount > 0;

export const standardLabel = (s: string) => STANDARD_LABELS[s.toUpperCase()] ?? s;

export const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Müsait",
  OCCUPIED: "Dolu",
  RESERVED: "Rezerve",
  OUT_OF_ORDER: "Arızalı",
  UNAVAILABLE: "Kullanılamaz",
  OFFLINE: "Çevrimdışı",
  UNKNOWN: "Bilinmiyor",
};
