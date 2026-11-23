import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { CACHE_TAGS } from "./cache-tags";
import { PROVINCES } from "@/lib/turkey";
import { slugify } from "@/lib/slug";
import type { MapPoint } from "@/lib/map-types";
import { FLAG } from "@/lib/map-types";

const cached = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, revalidate = 3600) =>
  unstable_cache(fn, [key], { tags: [CACHE_TAGS.stations], revalidate });

const ACTIVE = { isActive: true } satisfies Prisma.StationWhereInput;

// ─────────────────────────── Genel istatistikler ───────────────────────────

export const getStats = cached(async () => {
  const [stations, dc, ultra, providers, cities, connectors, lastSync] = await Promise.all([
    db.station.count({ where: ACTIVE }),
    db.station.count({ where: { ...ACTIVE, hasDc: true } }),
    db.station.count({ where: { ...ACTIVE, maxPowerKw: { gte: 150 } } }),
    db.provider.count({ where: { isActive: true, stationCount: { gt: 0 } } }),
    db.station.groupBy({ by: ["citySlug"], where: { ...ACTIVE, citySlug: { not: null } } }),
    db.station.aggregate({ where: ACTIVE, _sum: { totalConnectors: true } }),
    db.syncRun.findFirst({ where: { status: { in: ["SUCCESS", "PARTIAL"] } }, orderBy: { startedAt: "desc" } }),
  ]);
  return {
    stations,
    dc,
    ultra,
    providers,
    cities: cities.length,
    connectors: connectors._sum.totalConnectors ?? 0,
    lastSyncedAt: lastSync?.finishedAt?.toISOString() ?? null,
  };
}, "stats");

// ─────────────────────────── Şarj ağları ───────────────────────────

const providerSelect = {
  id: true,
  slug: true,
  name: true,
  website: true,
  logoUrl: true,
  description: true,
  color: true,
  stationCount: true,
  dcStationCount: true,
  connectorCount: true,
  maxPowerKw: true,
  minAcPrice: true,
  maxAcPrice: true,
  minDcPrice: true,
  maxDcPrice: true,
} satisfies Prisma.ProviderSelect;

export type ProviderListItem = Prisma.ProviderGetPayload<{ select: typeof providerSelect }>;

export const listProviders = cached(
  async () =>
    db.provider.findMany({
      where: { isActive: true, stationCount: { gt: 0 } },
      orderBy: [{ stationCount: "desc" }, { name: "asc" }],
      select: providerSelect,
    }),
  "providers",
);

export const getProviderBySlug = cached(async (slug: string) => {
  const provider = await db.provider.findUnique({
    where: { slug },
    select: { ...providerSelect, seoContent: true, lastSyncedAt: true },
  });
  if (!provider) return null;
  const [cities, ultra, standards] = await Promise.all([
    db.station.groupBy({
      by: ["citySlug", "city"],
      where: { ...ACTIVE, providerId: provider.id, citySlug: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { citySlug: "desc" } },
    }),
    db.station.count({ where: { ...ACTIVE, providerId: provider.id, maxPowerKw: { gte: 150 } } }),
    db.$queryRaw<{ standard: string; count: bigint }[]>`
      SELECT unnest(standards) AS standard, COUNT(*)::bigint AS count
      FROM "Station" WHERE "providerId" = ${provider.id} AND "isActive" = true
      GROUP BY 1 ORDER BY 2 DESC`,
  ]);
  return {
    ...provider,
    lastSyncedAt: provider.lastSyncedAt?.toISOString() ?? null,
    ultra,
    cities: cities.map((c) => ({ slug: c.citySlug!, name: c.city ?? c.citySlug!, count: c._count._all })),
    standards: standards.map((s) => ({ standard: s.standard, count: Number(s.count) })),
  };
}, "provider-by-slug");

/** Fiyat karşılaştırma tablosu: fiyat verisi olan ağlar, en ucuz DC'den pahalıya. */
export const getPriceTable = cached(async () => {
  const rows = await db.provider.findMany({
    where: { isActive: true, stationCount: { gt: 0 }, OR: [{ minAcPrice: { not: null } }, { minDcPrice: { not: null } }] },
    select: providerSelect,
  });
  return rows.sort((a, b) => (a.minDcPrice ?? 999) - (b.minDcPrice ?? 999));
}, "price-table");

// ─────────────────────────── Harita noktaları ───────────────────────────

export const getMapPoints = cached(
  async (filter: { providerId?: string; citySlug?: string }): Promise<{ providers: string[]; points: MapPoint[] }> => {
    const rows = await db.station.findMany({
      where: {
        ...ACTIVE,
        latitude: { not: null },
        longitude: { not: null },
        ...(filter.providerId ? { providerId: filter.providerId } : {}),
        ...(filter.citySlug ? { citySlug: filter.citySlug } : {}),
      },
      select: {
        uid: true,
        latitude: true,
        longitude: true,
        providerId: true,
        maxPowerKw: true,
        hasAc: true,
        hasDc: true,
        standards: true,
      },
    });
    const providers: string[] = [];
    const idx = new Map<string, number>();
    const points: MapPoint[] = rows.map((r) => {
      let pi = idx.get(r.providerId);
      if (pi === undefined) {
        pi = providers.push(r.providerId) - 1;
        idx.set(r.providerId, pi);
      }
      let flags = 0;
      if (r.hasAc) flags |= FLAG.AC;
      if (r.hasDc) flags |= FLAG.DC;
      for (const s of r.standards) {
        if (s.startsWith("CCS")) flags |= FLAG.CCS;
        else if (s === "TYPE2") flags |= FLAG.TYPE2;
        else if (s === "CHADEMO") flags |= FLAG.CHADEMO;
      }
      return [r.uid, Math.round(r.latitude! * 1e5) / 1e5, Math.round(r.longitude! * 1e5) / 1e5, pi, Math.round(r.maxPowerKw ?? 0), flags];
    });
    return { providers, points };
  },
  "map-points",
  1800,
);

// ─────────────────────────── İstasyon ───────────────────────────

export const stationCardSelect = {
  uid: true,
  slug: true,
  name: true,
  providerId: true,
  address: true,
  district: true,
  city: true,
  citySlug: true,
  latitude: true,
  longitude: true,
  maxPowerKw: true,
  hasAc: true,
  hasDc: true,
  standards: true,
  totalConnectors: true,
  minAcPrice: true,
  minDcPrice: true,
  provider: { select: { name: true, slug: true, color: true } },
} satisfies Prisma.StationSelect;

export type StationCard = Prisma.StationGetPayload<{ select: typeof stationCardSelect }>;

export async function getStationByUid(uid: string) {
  return db.station.findUnique({ where: { uid }, select: stationCardSelect });
}

export const getStationBySlug = cached(async (slug: string) => {
  const s = await db.station.findUnique({
    where: { slug },
    include: { provider: { select: { id: true, name: true, slug: true, color: true, website: true, logoUrl: true } } },
  });
  if (!s) return null;
  return {
    ...s,
    syncedAt: s.syncedAt.toISOString(),
    sourceUpdatedAt: s.sourceUpdatedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}, "station-by-slug");

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface StationSearch {
  q?: string;
  citySlug?: string;
  districtSlug?: string;
  providerIds?: string[];
  minPowerKw?: number;
  dcOnly?: boolean;
  standards?: string[];
  near?: { lat: number; lng: number; radiusKm?: number };
  sort?: "distance" | "power" | "price";
  limit?: number;
}

/** Ortak istasyon araması (metin arama, yapay zekâ araması ve "bana en yakın" bunu kullanır). */
export async function searchStations(input: StationSearch) {
  const limit = Math.min(input.limit ?? 20, 100);
  const where: Prisma.StationWhereInput = { ...ACTIVE };
  if (input.citySlug) where.citySlug = input.citySlug;
  if (input.districtSlug) where.districtSlug = input.districtSlug;
  if (input.providerIds?.length) where.providerId = { in: input.providerIds };
  if (input.minPowerKw) where.maxPowerKw = { gte: input.minPowerKw };
  if (input.dcOnly) where.hasDc = true;
  if (input.standards?.length) where.standards = { hasSome: input.standards.map((s) => s.toUpperCase()) };
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { district: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      // Türkçe karakter farkını tolere et: "kadikoy" → "Kadıköy"
      ...(slugify(q) ? [{ districtSlug: { contains: slugify(q) } }] : []),
    ];
  }

  if (input.near) {
    const r = input.near.radiusKm ?? 25;
    const dLat = r / 111;
    const dLng = r / (111 * Math.cos((input.near.lat * Math.PI) / 180));
    where.latitude = { gte: input.near.lat - dLat, lte: input.near.lat + dLat };
    where.longitude = { gte: input.near.lng - dLng, lte: input.near.lng + dLng };
    const rows = await db.station.findMany({ where, select: stationCardSelect, take: 2000 });
    return rows
      .map((s) => ({ ...s, distanceKm: haversineKm(input.near!.lat, input.near!.lng, s.latitude!, s.longitude!) }))
      .filter((s) => s.distanceKm <= r)
      .sort((a, b) =>
        input.sort === "power"
          ? (b.maxPowerKw ?? 0) - (a.maxPowerKw ?? 0)
          : input.sort === "price"
            ? (a.minDcPrice ?? a.minAcPrice ?? 999) - (b.minDcPrice ?? b.minAcPrice ?? 999)
            : a.distanceKm - b.distanceKm,
      )
      .slice(0, limit);
  }

  const orderBy: Prisma.StationOrderByWithRelationInput[] =
    input.sort === "price"
      ? [{ minDcPrice: { sort: "asc", nulls: "last" } }, { maxPowerKw: { sort: "desc", nulls: "last" } }]
      : [{ maxPowerKw: { sort: "desc", nulls: "last" } }, { name: "asc" }];
  const rows = await db.station.findMany({ where, select: stationCardSelect, orderBy, take: limit });
  return rows.map((s) => ({ ...s, distanceKm: null as number | null }));
}

export type StationSearchResult = Awaited<ReturnType<typeof searchStations>>[number];

// ─────────────────────────── İller ───────────────────────────

export const getCityTable = cached(async () => {
  const [all, dc] = await Promise.all([
    db.station.groupBy({ by: ["citySlug"], where: { ...ACTIVE, citySlug: { not: null } }, _count: { _all: true } }),
    db.station.groupBy({ by: ["citySlug"], where: { ...ACTIVE, citySlug: { not: null }, hasDc: true }, _count: { _all: true } }),
  ]);
  const dcMap = new Map(dc.map((d) => [d.citySlug, d._count._all]));
  const allMap = new Map(all.map((d) => [d.citySlug, d._count._all]));
  return PROVINCES.map((p) => ({ ...p, count: allMap.get(p.slug) ?? 0, dc: dcMap.get(p.slug) ?? 0 })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"),
  );
}, "city-table");

export const getCityDetail = cached(async (citySlug: string) => {
  const where = { ...ACTIVE, citySlug };
  const [count, dc, ultra, providers, districts, fastest, center] = await Promise.all([
    db.station.count({ where }),
    db.station.count({ where: { ...where, hasDc: true } }),
    db.station.count({ where: { ...where, maxPowerKw: { gte: 150 } } }),
    db.station.groupBy({ by: ["providerId"], where, _count: { _all: true }, orderBy: { _count: { providerId: "desc" } } }),
    db.station.groupBy({
      by: ["districtSlug", "district"],
      where: { ...where, districtSlug: { not: null } },
      _count: { _all: true },
      _max: { maxPowerKw: true },
      orderBy: { _count: { districtSlug: "desc" } },
    }),
    db.station.findMany({
      where,
      select: stationCardSelect,
      orderBy: [{ maxPowerKw: { sort: "desc", nulls: "last" } }],
      take: 15,
    }),
    db.station.aggregate({ where: { ...where, latitude: { not: null } }, _avg: { latitude: true, longitude: true } }),
  ]);
  const dcByProvider = await db.station.groupBy({ by: ["providerId"], where: { ...where, hasDc: true }, _count: { _all: true } });
  const dcByDistrict = await db.station.groupBy({
    by: ["districtSlug"],
    where: { ...where, hasDc: true, districtSlug: { not: null } },
    _count: { _all: true },
  });
  const providerInfo = await db.provider.findMany({
    where: { id: { in: providers.map((p) => p.providerId) } },
    select: { id: true, name: true, slug: true, color: true, minDcPrice: true },
  });
  const pMap = new Map(providerInfo.map((p) => [p.id, p]));
  const dcP = new Map(dcByProvider.map((d) => [d.providerId, d._count._all]));
  const dcD = new Map(dcByDistrict.map((d) => [d.districtSlug, d._count._all]));

  return {
    count,
    dc,
    ultra,
    center:
      center._avg.latitude && center._avg.longitude ? { lat: center._avg.latitude, lng: center._avg.longitude } : null,
    providers: providers
      .map((p) => ({ ...pMap.get(p.providerId)!, count: p._count._all, dc: dcP.get(p.providerId) ?? 0 }))
      .filter((p) => p.id),
    districts: districts.map((d) => ({
      slug: d.districtSlug!,
      name: d.district ?? d.districtSlug!,
      count: d._count._all,
      dc: dcD.get(d.districtSlug) ?? 0,
      maxPowerKw: d._max.maxPowerKw,
    })),
    fastest,
  };
}, "city-detail");

export async function getNearbyStations(lat: number, lng: number, excludeUid: string, limit = 6) {
  const rows = await searchStations({ near: { lat, lng, radiusKm: 15 }, limit: limit + 1 });
  return rows.filter((r) => r.uid !== excludeUid).slice(0, limit);
}

export const getAllStationSlugs = cached(
  async () =>
    db.station.findMany({ where: ACTIVE, select: { slug: true, syncedAt: true } }).then((rows) =>
      rows.map((r) => ({ slug: r.slug, syncedAt: r.syncedAt.toISOString() })),
    ),
  "station-slugs",
  21600,
);
