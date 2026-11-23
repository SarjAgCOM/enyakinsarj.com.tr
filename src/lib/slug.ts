const TR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/** Türkçe karakterleri sadeleştirip URL dostu slug üretir: "Kadıköy Sahil" → "kadikoy-sahil" */
export function slugify(input: string | null | undefined, maxLength = 80): string {
  if (!input) return "";
  const lower = input.toLocaleLowerCase("tr-TR");
  let out = "";
  for (const ch of lower) out += TR_MAP[ch] ?? ch;
  return out
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Kısa, deterministik hash (FNV-1a, base36) — istasyon slug'larını benzersiz kılmak için. */
export function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
