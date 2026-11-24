import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimit } from "../trpc";
import {
  getMapPoints,
  getStationByUid,
  listProviders,
  searchStations,
  getCityTable,
} from "../../services/stations";
import { sarjag, SarjagError } from "../../sarjag/client";
import { AiError, isAiSearchAvailable, parseSearchIntent } from "../../ai";
import { PROVINCES, matchProvince } from "@/lib/turkey";
import { slugify } from "@/lib/slug";

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const searchInput = z.object({
  q: z.string().max(100).optional(),
  citySlug: z.string().max(40).optional(),
  districtSlug: z.string().max(60).optional(),
  providerIds: z.array(z.string().max(40)).max(30).optional(),
  minPowerKw: z.number().min(0).max(1000).optional(),
  dcOnly: z.boolean().optional(),
  standards: z.array(z.enum(["CCS2", "TYPE2", "CHADEMO"])).optional(),
  near: latLng.extend({ radiusKm: z.number().min(1).max(100).optional() }).optional(),
  sort: z.enum(["distance", "power", "price"]).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

// Anlık durum yanıtlarını kısa süre önbellekte tut (token tasarrufu).
const statusCache = new Map<string, { at: number; data: unknown }>();

export const stationRouter = createTRPCRouter({
  mapPoints: publicProcedure
    .input(z.object({ providerId: z.string().max(40).optional(), citySlug: z.string().max(40).optional() }))
    .query(({ input, ctx }) => {
      // Tüm istasyon noktalarını döndüren pahalı çağrı: IP başına dakikada 20
      rateLimit(`map:${ctx.ip}`, 20, 60_000);
      return getMapPoints(input);
    }),

  byUid: publicProcedure.input(z.object({ uid: z.string().max(200) })).query(async ({ input, ctx }) => {
    // Tek tek istasyon çekerek veri toplamayı yavaşlatır
    rateLimit(`uid:${ctx.ip}`, 60, 60_000);
    const s = await getStationByUid(input.uid);
    if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "İstasyon bulunamadı" });
    return s;
  }),

  search: publicProcedure.input(searchInput).query(({ input, ctx }) => {
    rateLimit(`search:${ctx.ip}`, 40, 60_000);
    return searchStations(input);
  }),

  liveStatus: publicProcedure.input(z.object({ uid: z.string().max(200) })).query(async ({ input, ctx }) => {
    const hit = statusCache.get(input.uid);
    if (hit && Date.now() - hit.at < 90_000) return hit.data as Awaited<ReturnType<typeof fetchStatus>>;
    rateLimit(`status:${ctx.ip}`, 20, 60_000);
    const station = await ctx.db.station.findUnique({ where: { uid: input.uid }, select: { providerId: true, externalId: true } });
    if (!station) throw new TRPCError({ code: "NOT_FOUND", message: "İstasyon bulunamadı" });
    const data = await fetchStatus(station.providerId, station.externalId);
    statusCache.set(input.uid, { at: Date.now(), data });
    if (statusCache.size > 5000) statusCache.clear();
    return data;
  }),
});

async function fetchStatus(providerId: string, externalId: string) {
  try {
    const { data } = await sarjag.status(providerId, [externalId]);
    const s = data.data[0];
    if (!s) return { ok: false as const, message: data.errors[0]?.message ?? "Anlık durum alınamadı" };
    return {
      ok: true as const,
      fetchedAt: s.fetchedAt ?? data.fetchedAt ?? new Date().toISOString(),
      available: s.available,
      total: s.total,
      connectors: s.connectors.map((c) => ({
        uid: c.uid,
        evseId: c.evseId ?? null,
        powerType: c.powerType ?? null,
        maxPowerKw: c.maxPowerKw ?? null,
        status: c.status,
      })),
    };
  } catch (e) {
    return { ok: false as const, message: e instanceof SarjagError ? e.message : "Anlık durum alınamadı" };
  }
}

export const providerRouter = createTRPCRouter({
  list: publicProcedure.query(() => listProviders()),
});

export const aiRouter = createTRPCRouter({
  /** Doğal dilde istasyon araması: "Kadıköy'de 150 kW üstü Trugo" → filtreler → sonuçlar */
  search: publicProcedure
    .input(z.object({ query: z.string().min(3).max(300), location: latLng.optional() }))
    .mutation(async ({ input, ctx }) => {
      // Sezgisel ayrıştırma: il, ağ, DC, kW ve "yakın" ifadelerini yakalar. Yapay zekâ kapalıyken ya da
      // hata verdiğinde (kota, zaman aşımı) kullanılır; böylece arama her durumda sonuç döndürür.
      const heuristicSearch = async () => {
        const providers = await listProviders();
        const h = heuristicIntent(input.query, providers);
        const near = h.useMyLocation && input.location ? { ...input.location, radiusKm: 30 } : undefined;
        const results = await searchStations({
          citySlug: near ? undefined : h.citySlug,
          providerIds: h.providerIds,
          dcOnly: h.dcOnly,
          minPowerKw: h.minPowerKw,
          q: h.q,
          near,
          sort: near ? "distance" : "power",
          limit: 20,
        });
        return {
          intent: null,
          reply: `"${input.query}" için arama sonuçları`,
          results,
          needsLocation: h.useMyLocation && !input.location,
        };
      };
      if (!isAiSearchAvailable()) return heuristicSearch();
      rateLimit(`ai:${ctx.ip}`, 8, 60_000);
      const providers = await listProviders();
      const cityTable = await getCityTable();
      let intent;
      try {
        intent = await parseSearchIntent(input.query, {
          providers: providers.map((p) => ({ id: p.id, name: p.name })),
          cities: PROVINCES.filter((p) => cityTable.find((c) => c.slug === p.slug && c.count > 0)).map((p) => ({
            slug: p.slug,
            name: p.name,
          })),
        });
      } catch (e) {
        if (!(e instanceof AiError)) throw e;
        console.warn(`Yapay zekâ araması başarısız, sezgisel aramaya düşüldü: ${e.message}`);
        return heuristicSearch();
      }
      const validProviders = intent.providerIds.filter((id) => providers.some((p) => p.id === id));
      const near = intent.useMyLocation && input.location ? { ...input.location, radiusKm: 30 } : undefined;
      const results = await searchStations({
        citySlug: near ? undefined : (intent.citySlug ?? undefined),
        districtSlug: near ? undefined : (intent.districtSlug ?? undefined),
        providerIds: validProviders,
        minPowerKw: intent.minPowerKw ?? undefined,
        dcOnly: intent.dcOnly,
        standards: intent.standards,
        q: intent.query ?? undefined,
        near,
        sort: near ? intent.sort : intent.sort === "distance" ? "power" : intent.sort,
        limit: 20,
      });
      return { intent, reply: intent.reply, results, needsLocation: intent.useMyLocation && !input.location };
    }),
});

export const blogRouter = createTRPCRouter({
  view: publicProcedure.input(z.object({ slug: z.string().max(200) })).mutation(async ({ input, ctx }) => {
    try {
      rateLimit(`view:${ctx.ip}:${input.slug}`, 1, 30 * 60_000);
    } catch {
      return { ok: false };
    }
    await ctx.db.post.updateMany({ where: { slug: input.slug, status: "PUBLISHED" }, data: { viewCount: { increment: 1 } } });
    return { ok: true };
  }),
});

const STOPWORDS = new Set([
  "sarj", "istasyon", "istasyonu", "istasyonlari", "istasyonlar", "en", "bana", "yakin", "yakinimda", "yakinindaki",
  "civarinda", "ve", "ile", "icin", "hizli", "ultra", "dc", "ac", "kw", "ustu", "uzeri", "da", "de", "ta", "te",
  "ucuz", "arac", "elektrikli", "nerede", "var", "mi", "noktasi",
]);

/** Yapay zekâ anahtarı yokken kullanılan basit sorgu ayrıştırıcı. */
export function heuristicIntent(query: string, providers: { id: string; name: string; slug: string }[]) {
  const tokens = slugify(query, 300).split("-").filter(Boolean);
  const citySlug = tokens.map((t) => matchProvince(t)?.slug).find(Boolean);
  const providerIds = providers
    .filter((p) => tokens.some((t) => t.length > 2 && (slugify(p.name).replace(/-/g, "") === t || p.slug === t || p.id === t)))
    .map((p) => p.id);
  const kw = query.match(/(\d{2,3})\s*kw/i);
  const ultra = /ultra/i.test(query);
  const dcOnly = /\b(dc|hızlı|hizli|ccs)\b/i.test(query) || ultra;
  const useMyLocation = tokens.some((t) => t.startsWith("yakin") || t.startsWith("civar") || t === "yanimda");
  const rest = tokens.filter(
    (t) =>
      !STOPWORDS.has(t) &&
      !/^\d+$/.test(t) &&
      matchProvince(t)?.slug !== t &&
      !providers.some((p) => p.id === t || slugify(p.name).replace(/-/g, "") === t),
  );
  return {
    citySlug,
    providerIds,
    dcOnly,
    minPowerKw: kw ? Number(kw[1]) : ultra ? 150 : undefined,
    useMyLocation,
    // Kalan ilk anlamlı kelime (çoğunlukla ilçe/mekân adı) metin araması olarak kullanılır.
    q: rest.find((t) => t.length > 2),
  };
}
