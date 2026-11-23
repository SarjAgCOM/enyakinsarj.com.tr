import { slugify } from "./slug";

export interface Province {
  plate: number;
  name: string;
  slug: string;
}

const NAMES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir",
  "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
  "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari",
  "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
  "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir",
  "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
  "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
  "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye",
  "Düzce",
];

export const PROVINCES: Province[] = NAMES.map((name, i) => ({ plate: i + 1, name, slug: slugify(name) }));

const BY_SLUG = new Map(PROVINCES.map((p) => [p.slug, p]));

/** Sık görülen yazım farkları → resmi il slug'ı */
const ALIASES: Record<string, string> = {
  icel: "mersin",
  "k-maras": "kahramanmaras",
  maras: "kahramanmaras",
  urfa: "sanliurfa",
  antep: "gaziantep",
  afyon: "afyonkarahisar",
  izmit: "kocaeli",
  adapazari: "sakarya",
  hakkâri: "hakkari",
};

export function provinceBySlug(slug: string): Province | undefined {
  return BY_SLUG.get(slug);
}

/** API'den gelen serbest şehir metnini (ör. "İSTANBUL", "Istanbul / Kadıköy") il kaydına eşler. */
export function matchProvince(raw: string | null | undefined): Province | undefined {
  if (!raw) return undefined;
  const s = slugify(raw);
  if (!s) return undefined;
  const direct = BY_SLUG.get(s) ?? BY_SLUG.get(ALIASES[s] ?? "");
  if (direct) return direct;
  // "istanbul-kadikoy" gibi birleşik değerler
  for (const part of s.split("-")) {
    const p = BY_SLUG.get(part) ?? BY_SLUG.get(ALIASES[part] ?? "");
    if (p) return p;
  }
  return undefined;
}

/** Türkçe bulunma eki: "İstanbul" → "İstanbul'da", "İzmir" → "İzmir'de", "Konya" → "Konya'da", "Kars" → "Kars'ta" */
export function locative(name: string): string {
  const lower = name.toLocaleLowerCase("tr-TR");
  const vowels = Array.from(lower).filter((c) => "aıoueiöü".includes(c));
  const last = vowels[vowels.length - 1] ?? "a";
  const back = "aıou".includes(last);
  const hard = "fstkçşhp".includes(lower[lower.length - 1] ?? "");
  return `${name}'${hard ? "t" : "d"}${back ? "a" : "e"}`;
}
export const locativeKi = (name: string) => `${locative(name)}ki`;
