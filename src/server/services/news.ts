import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { AiError, generateNewsPost, isAiLongFormAvailable } from "../ai";
import { publishPost, revalidatePosts, uniquePostSlug } from "./posts";
import { extractArticleText, extractForumPost, isEvRelated, isSameStory, parseFeed, titleTokens } from "@/lib/feed";

/**
 * Haber akışı: Türkiye'deki otomobil / teknoloji yayınlarının RSS akışlarından elektrikli araç haberlerini
 * toplar ve her haber için yapay zekâya ÖZGÜN bir haber yazdırır.
 *
 *  - Kaynak metin yalnızca bilgi olarak kullanılır; yayınlanan yazı yeniden yazılmıştır ve kaynağa bağlantı verir.
 *  - Kaynak sitelerin görselleri ALINMAZ (telif). Kapak görseli sitenin kendi ürettiği görseldir (/kapak/…).
 *  - Aynı haber birden fazla kaynakta çıkarsa yalnızca biri işlenir.
 */

// ─────────────────────────── Ayarlar ───────────────────────────

const SETTING_KEY = "news";

export interface NewsSettings {
  /** Cron ile otomatik tarama ve üretim */
  enabled: boolean;
  /** Üretilen haber doğrudan yayınlansın mı (kapalıysa taslak olarak kalır) */
  autoPublish: boolean;
  /** Bir günde üretilecek en fazla haber */
  dailyLimit: number;
  /** Kaynakların taranma aralığı (dakika) */
  intervalMinutes: number;
  lastFetchedAt: string | null;
}

const DEFAULT_SETTINGS: NewsSettings = { enabled: false, autoPublish: false, dailyLimit: 6, intervalMinutes: 60, lastFetchedAt: null };

export async function getNewsSettings(): Promise<NewsSettings> {
  const row = await db.setting.findUnique({ where: { key: SETTING_KEY } });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<NewsSettings> | null) ?? {}) };
}

export async function saveNewsSettings(patch: Partial<NewsSettings>) {
  const value = { ...(await getNewsSettings()), ...patch };
  await db.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: { ...value } }, update: { value: { ...value } } });
  return value;
}

// ─────────────────────────── Kaynaklar ───────────────────────────

/** Kasım 2026'da erişilebilir olduğu ve elektrikli araç haberi içerdiği doğrulanan akışlar. */
const DEFAULT_SOURCES: { name: string; feedUrl: string; enabled: boolean }[] = [
  { name: "ShiftDelete.Net Otomobil", feedUrl: "https://shiftdelete.net/otomobil/feed", enabled: true },
  { name: "TEHAD", feedUrl: "https://www.tehad.org/feed/", enabled: true },
  { name: "NTV Otomobil", feedUrl: "https://www.ntv.com.tr/otomobil.rss", enabled: true },
  { name: "CNN Türk Otomobil", feedUrl: "https://www.cnnturk.com/feed/rss/otomobil/news", enabled: true },
  { name: "Sözcü Otomotiv", feedUrl: "https://www.sozcu.com.tr/feeds-rss-category-otomotiv", enabled: true },
  { name: "Habertürk Otomobil", feedUrl: "https://www.haberturk.com/rss/otomobil.xml", enabled: true },
  { name: "Otoaktüel", feedUrl: "https://www.otoaktuel.com.tr/rss", enabled: true },
  { name: "Motor1 Türkiye", feedUrl: "https://tr.motor1.com/rss/news/all/", enabled: true },
  { name: "Otopark", feedUrl: "https://www.otopark.com/feed/", enabled: false },
  { name: "Otogüncel", feedUrl: "https://www.otoguncel.com/feed/", enabled: false },
  { name: "Carmedya", feedUrl: "https://www.carmedya.com/feed/", enabled: false },
  { name: "DonanımHaber", feedUrl: "https://www.donanimhaber.com/rss/tum/", enabled: false },
  { name: "Webtekno", feedUrl: "https://www.webtekno.com/rss.xml", enabled: false },
  { name: "Enerji Günlüğü", feedUrl: "https://www.enerjigunlugu.net/rss", enabled: false },
  // Forum (XenForo): akış son yanıt tarihine göre sıralanır, bkz. generateFromNewsItem içindeki `skipStale`.
  { name: "Şarj Hattı", feedUrl: "https://sarjhatti.com/forums/-/index.rss", enabled: true },
];

/** Tablo boşsa varsayılan kaynakları ekler. */
export async function ensureDefaultSources() {
  if ((await db.newsSource.count()) > 0) return;
  await db.newsSource.createMany({ data: DEFAULT_SOURCES, skipDuplicates: true });
}

// ─────────────────────────── Güvenli indirme ───────────────────────────

const USER_AGENT = "Mozilla/5.0 (compatible; EnYakinSarjBot/1.0; +https://www.enyakinsarj.com.tr)";

function isPrivateAddress(ip: string) {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224;
}

/** Yalnızca genel internet adreslerine izin verir (yönetici bile iç ağ adresi veremesin). */
async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Geçersiz adres.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Adres http veya https ile başlamalı.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error("Bu adrese erişime izin verilmiyor.");
  return url;
}

/** Metin indirir: boyut sınırı, zaman aşımı ve karakter kümesi algılama (bazı siteler windows-1254 kullanır). */
async function fetchText(raw: string, maxBytes: number): Promise<string> {
  let url = await assertPublicUrl(raw);
  let res: Response | undefined;
  // Yönlendirmeler elle izlenir; her adım ayrıca denetlenir.
  for (let hop = 0; hop < 5; hop++) {
    res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5" },
      signal: AbortSignal.timeout(15_000),
    });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) break;
    url = await assertPublicUrl(new URL(location, url).toString());
  }
  if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? "?"}`);

  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const bytes = Buffer.concat(chunks).subarray(0, maxBytes);
  const head = bytes.subarray(0, 1024).toString("latin1");
  const charset =
    /charset=["']?([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1] ??
    /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Yeni kaynak eklenirken akışın okunabildiğini ve haber içerdiğini doğrular. */
export async function validateFeed(feedUrl: string) {
  const items = parseFeed(await fetchText(feedUrl, 3_000_000));
  if (items.length === 0) throw new Error("Bu adreste RSS / Atom biçiminde haber bulunamadı.");
  return { items: items.length, evItems: items.filter((i) => isEvRelated(`${i.title} ${i.summary}`)).length };
}

// ─────────────────────────── Tarama ───────────────────────────

const MAX_NEW_PER_SOURCE = 8;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/** Etkin kaynakları tarar; yeni elektrikli araç haberlerini kuyruğa (NEW) alır. */
export async function fetchNewsSources() {
  await ensureDefaultSources();
  const sources = await db.newsSource.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Son bir haftada görülen başlıklar: aynı haberi farklı kaynaktan ikinci kez almamak için.
  const [recentItems, recentPosts] = await Promise.all([
    db.newsItem.findMany({ where: { createdAt: { gte: since }, status: { in: ["NEW", "GENERATED"] } }, select: { title: true } }),
    db.post.findMany({ where: { createdAt: { gte: since } }, select: { title: true } }),
  ]);
  const seen = [...recentItems, ...recentPosts].map((r) => titleTokens(r.title));

  let added = 0;
  const errors: { source: string; error: string }[] = [];

  for (const source of sources) {
    try {
      const items = parseFeed(await fetchText(source.feedUrl, 3_000_000));
      if (items.length === 0) throw new Error("Akışta haber bulunamadı (RSS / Atom biçiminde olmayabilir).");

      const known = new Set(
        (await db.newsItem.findMany({ where: { sourceId: source.id, guid: { in: items.map((i) => i.guid) } }, select: { guid: true } })).map(
          (r) => r.guid,
        ),
      );
      const rows: Prisma.NewsItemCreateManyInput[] = [];
      let queued = 0;
      for (const item of items) {
        if (known.has(item.guid)) continue;
        known.add(item.guid);
        const base = { sourceId: source.id, guid: item.guid, url: item.url, title: item.title, summary: item.summary.slice(0, 4000), publishedAt: item.publishedAt };
        const tokens = titleTokens(item.title);
        let skip: string | null = null;
        if (item.publishedAt && Date.now() - item.publishedAt.getTime() > MAX_AGE_MS) skip = "Eski haber";
        else if (!isEvRelated(`${item.title} ${item.summary}`)) skip = "Konu dışı";
        else if (seen.some((s) => isSameStory(s, tokens))) skip = "Benzer haber zaten var";
        else if (queued >= MAX_NEW_PER_SOURCE) skip = "Tarama başına sınır aşıldı";

        if (skip) {
          rows.push({ ...base, status: "SKIPPED", note: skip });
        } else {
          rows.push(base);
          seen.push(tokens);
          queued++;
        }
      }
      if (rows.length) await db.newsItem.createMany({ data: rows, skipDuplicates: true });
      added += queued;
      await db.newsSource.update({ where: { id: source.id }, data: { lastFetchedAt: new Date(), lastError: null } });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      errors.push({ source: source.name, error });
      await db.newsSource.update({ where: { id: source.id }, data: { lastFetchedAt: new Date(), lastError: error.slice(0, 300) } });
    }
  }

  // Atlanan eski kayıtlar tabloyu şişirmesin.
  await db.newsItem.deleteMany({ where: { status: "SKIPPED", createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } });
  await saveNewsSettings({ lastFetchedAt: new Date().toISOString() });
  return { sources: sources.length, added, errors };
}

// ─────────────────────────── Üretim ───────────────────────────

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/**
 * Kuyruktaki bir haberden özgün yazı üretir. `publish` true ise yayınlar (ve otomatik paylaşım açıksa paylaşır),
 * değilse taslak olarak bırakır.
 *
 * `skipStale`: forum akışlarında tarih son yanıta aittir, yani aylar önce açılmış bir konu yeni bir yanıtla
 * "yeni" görünebilir. Otomatik döngü bu konuları atlar; editör elle ürettiğinde karar ona bırakılır.
 */
export async function generateFromNewsItem(itemId: string, opts: { publish: boolean; authorId?: string; skipStale?: boolean }) {
  const item = await db.newsItem.findUniqueOrThrow({ where: { id: itemId }, include: { source: true } });
  if (item.postId) return { status: "GENERATED" as const, postId: item.postId };

  // Haber sayfasının metni yalnızca yapay zekâya bilgi olarak verilir; okunamazsa akıştaki özetle yetinilir.
  const html = await fetchText(item.url, 1_500_000).catch(() => "");
  if (opts.skipStale) {
    const opened = extractForumPost(html)?.publishedAt;
    if (opened && Date.now() - opened.getTime() > MAX_AGE_MS) {
      const note = "Eski konu (yeni yanıtla öne çıkmış)";
      await db.newsItem.update({ where: { id: item.id }, data: { status: "SKIPPED", note } });
      return { status: "SKIPPED" as const, note };
    }
  }
  const body = extractArticleText(html);
  if (body.length + (item.summary?.length ?? 0) < 120) {
    await db.newsItem.update({ where: { id: item.id }, data: { status: "SKIPPED", note: "Yeterli bilgi yok" } });
    return { status: "SKIPPED" as const, note: "Yeterli bilgi yok" };
  }

  let out;
  try {
    out = await generateNewsPost({ title: item.title, summary: item.summary ?? "", body, sourceName: item.source.name, publishedAt: item.publishedAt });
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
    // İlk hata geçici olabilir (kota, zaman aşımı): haber kuyrukta kalır. İkinci hatada başarısız sayılır.
    const again = item.note?.startsWith("Hata:");
    await db.newsItem.update({ where: { id: item.id }, data: { status: again ? "FAILED" : "NEW", note: `Hata: ${e.message}`.slice(0, 300) } });
    throw e;
  }

  if (!out.relevant || out.content.trim().length < 200) {
    await db.newsItem.update({ where: { id: item.id }, data: { status: "SKIPPED", note: "Yapay zekâ konu dışı buldu" } });
    return { status: "SKIPPED" as const, note: "Yapay zekâ konu dışı buldu" };
  }

  const category = await db.category.findUnique({ where: { slug: "haberler" }, select: { id: true } });
  const post = await db.post.create({
    data: {
      slug: await uniquePostSlug(out.slug || out.title),
      title: clip(out.title.trim(), 200),
      excerpt: clip(out.excerpt.trim(), 500) || null,
      content: out.content.trim(),
      coverImageAlt: clip(out.coverImageAlt.trim(), 300) || null,
      seoTitle: clip(out.seoTitle.trim(), 120) || null,
      seoDescription: clip(out.seoDescription.trim(), 320) || null,
      keywords: out.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 12),
      tags: out.tags.map((t) => t.trim()).filter(Boolean).slice(0, 8),
      highlights: out.highlights.map((h) => clip(h.trim(), 120)).filter(Boolean).slice(0, 4),
      socialX: out.socialX.trim() || null,
      socialInstagram: out.socialInstagram.trim() || null,
      categoryId: category?.id ?? null,
      authorId: opts.authorId ?? null,
      aiGenerated: true,
      sourceName: item.source.name,
      sourceUrl: item.url,
    },
  });
  await db.newsItem.update({ where: { id: item.id }, data: { status: "GENERATED", postId: post.id, note: null } });
  if (opts.publish) await publishPost(post.id);
  else revalidatePosts();
  return { status: "GENERATED" as const, postId: post.id, published: opts.publish };
}

// ─────────────────────────── Cron döngüsü ───────────────────────────

let running = false;

/**
 * Cron her çağırdığında: aralık dolduysa kaynakları tarar, ardından günlük sınır dolmadıysa kuyruktan
 * BİR haber üretir (cron birkaç dakikada bir çalıştığı için üretim güne yayılır ve servis kotaları zorlanmaz).
 */
export async function runNewsCycle() {
  const settings = await getNewsSettings();
  if (!settings.enabled) return { skipped: "kapalı" };
  if (running) return { skipped: "zaten çalışıyor" };
  running = true;
  try {
    const due = !settings.lastFetchedAt || Date.now() - new Date(settings.lastFetchedAt).getTime() >= settings.intervalMinutes * 60_000;
    const fetched = due ? await fetchNewsSources() : null;

    if (!(await isAiLongFormAvailable())) return { fetched, generated: null, note: "Haber üretimi için anahtarlı bir yapay zekâ sağlayıcısı gerekli" };

    const today = await db.post.count({ where: { sourceUrl: { not: null }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
    if (today >= settings.dailyLimit) return { fetched, generated: null, note: "Günlük sınır doldu" };

    const next = await db.newsItem.findFirst({ where: { status: "NEW" }, orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] });
    if (!next) return { fetched, generated: null };
    const generated = await generateFromNewsItem(next.id, { publish: settings.autoPublish, skipStale: true }).catch((e: Error) => ({ error: e.message }));
    return { fetched, generated };
  } finally {
    running = false;
  }
}
