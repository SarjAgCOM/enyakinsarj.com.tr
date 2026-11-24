/**
 * RSS / Atom akışı ve haber sayfası metni için bağımsız yardımcılar (ağ erişimi yok, saf işlevler).
 * Bağımlılık eklememek için küçük, toleranslı bir ayrıştırıcı kullanılır; akışlar güvenilmeyen girdi sayılır.
 */

export interface FeedItem {
  guid: string;
  url: string;
  title: string;
  /** Düz metin özet (HTML ayıklanmış, kısaltılmış) */
  summary: string;
  publishedAt: Date | null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
  uuml: "ü",
  Uuml: "Ü",
  ouml: "ö",
  Ouml: "Ö",
  ccedil: "ç",
  Ccedil: "Ç",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code] ?? m;
  });
}

const stripCdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

/** HTML'i düz metne çevirir: betik ve stil blokları atılır, blok etiketleri satır sonuna döner. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|svg|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(decodeEntities(text))
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function tag(block: string, names: string[]): string {
  for (const name of names) {
    const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
    if (m && m[1].trim()) return stripCdata(m[1]).trim();
  }
  return "";
}

function atomLink(block: string): string {
  const links = block.match(/<link\b[^>]*>/gi) ?? [];
  const pick = links.find((l) => /rel=["']alternate["']/i.test(l)) ?? links.find((l) => !/rel=/i.test(l)) ?? links[0];
  return pick ? (/href=["']([^"']+)["']/i.exec(pick)?.[1] ?? "") : "";
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const isHttpUrl = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);

/** RSS 2.0 ve Atom akışlarını ayrıştırır. Bağlantısı veya başlığı olmayan girdiler atlanır. */
export function parseFeed(xml: string, maxItems = 60): FeedItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items: FeedItem[] = [];
  for (const block of blocks.slice(0, maxItems)) {
    const title = htmlToText(tag(block, ["title"])).replace(/\s+/g, " ").slice(0, 300);
    const url = decodeEntities(tag(block, ["link"]) || atomLink(block) || tag(block, ["guid", "id"])).trim();
    if (!title || !isHttpUrl(url)) continue;
    const rich = tag(block, ["content:encoded", "content"]);
    const short = tag(block, ["description", "summary"]);
    const summary = htmlToText(rich.length > short.length ? rich : short).slice(0, 6000);
    items.push({
      guid: (decodeEntities(tag(block, ["guid", "id"])).trim() || url).slice(0, 500),
      url: url.slice(0, 1000),
      title,
      summary,
      publishedAt: parseDate(tag(block, ["pubDate", "published", "updated", "dc:date"])),
    });
  }
  return items;
}

/**
 * Haber sayfasından ana metni çıkarır (yalnızca yapay zekâya bilgi kaynağı olarak verilir, yayınlanmaz).
 * Önce JSON-LD `articleBody`, yoksa <article> / <main> içindeki paragraflar kullanılır.
 */
export function extractArticleText(html: string, maxChars = 6000): string {
  const ld = /"articleBody"\s*:\s*"((?:[^"\\]|\\.){200,})"/.exec(html);
  if (ld) {
    try {
      const body = htmlToText(JSON.parse(`"${ld[1]}"`) as string);
      if (body.length >= 200) return body.slice(0, maxChars);
    } catch {
      // JSON-LD bozuksa paragraflara düşülür
    }
  }
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|nav|header|footer|aside|form|figure)\b[\s\S]*?<\/\1>/gi, " ");
  const scope = /<article\b[\s\S]*?<\/article>/i.exec(cleaned)?.[0] ?? /<main\b[\s\S]*?<\/main>/i.exec(cleaned)?.[0] ?? cleaned;
  const paragraphs = (scope.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [])
    .map((p) => htmlToText(p).replace(/\s+/g, " "))
    .filter((p) => p.length >= 60);
  return paragraphs.join("\n").slice(0, maxChars);
}

// ─────────────────────────── Konu ve benzerlik ───────────────────────────

const EV_PATTERN =
  /elektrikli|şarj|sarj|batarya|\bEV\b|\bTOGG\b|tesla|\bBYD\b|menzil|\bkWh\b|hibrit|plug-?in|e-?mobilite|sıfır emisyon|wallbox|trugo|\bZES\b|eşarj/i;

/** Başlık veya özet elektrikli araç / şarj konusuna değiniyor mu (kaba ön eleme; kesin karar yapay zekâda). */
export const isEvRelated = (text: string) => EV_PATTERN.test(text);

const STOPWORDS = new Set([
  "ve", "ile", "bir", "bu", "için", "icin", "da", "de", "ta", "te", "mi", "mı", "mu", "mü", "en", "çok", "cok", "yeni", "ilk",
  "son", "daha", "olarak", "oldu", "olan", "ise", "gibi", "kadar", "var", "yok", "the", "işte", "iste", "nasıl", "neden",
  "geliyor", "geldi", "tanıtıldı", "tanıttı", "açıklandı", "açıkladı", "belli", "türkiye", "türkiye'de",
]);

export function titleTokens(title: string): Set<string> {
  const words = title
    .toLocaleLowerCase("tr-TR")
    .replace(/['’`][\p{L}]+/gu, "") // ek kesmesi: "Tesla'nın" → "tesla"
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

/** İki başlığın ortak kelime oranı (0–1). Aynı haberi farklı sitelerden iki kez almamak için kullanılır. */
export function titleSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / Math.min(a.size, b.size);
}

/** Benzerlik eşiği: küçük kümedeki kelimelerin en az bu oranı ortaksa (ve en az 3 ortak kelime varsa) aynı haber sayılır. */
export function isSameStory(a: Set<string>, b: Set<string>): boolean {
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common >= 3 && titleSimilarity(a, b) >= 0.6;
}
