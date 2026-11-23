import "server-only";
import { revalidateTag } from "next/cache";
import { db } from "../db";
import { env } from "../env";
import { sarjag, SarjagError } from "../sarjag/client";
import type { SarjagPrice, SarjagStation } from "../sarjag/schemas";
import { shortHash, slugify } from "@/lib/slug";
import { matchProvince } from "@/lib/turkey";
import { CACHE_TAGS } from "./cache-tags";

const PALETTE = [
  "#16a34a", "#2563eb", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777",
  "#4f46e5", "#059669", "#7c3aed", "#e11d48", "#0d9488", "#65a30d", "#c026d3", "#0284c7",
];
export const colorFor = (id: string) => PALETTE[parseInt(shortHash(id), 36) % PALETTE.length];

function minPrice(prices: SarjagPrice[], type: "AC" | "DC"): number | null {
  const vals = prices
    .filter((p) => p.powerType === type && typeof p.energyPerKwh === "number" && p.energyPerKwh > 0)
    .map((p) => p.energyPerKwh as number);
  return vals.length ? Math.min(...vals) : null;
}

export function mapStation(s: SarjagStation, providerId: string) {
  const loc = s.location;
  const province = matchProvince(loc.city) ?? matchProvince(loc.address);
  const name = (s.name ?? s.code ?? s.externalId).trim();
  const powerTypes = new Set<string>(s.summary.powerTypes);
  for (const c of s.connectors) if (c.powerType) powerTypes.add(c.powerType);

  // Fiyatlar hem istasyon seviyesinde hem soket seviyesinde gelebilir.
  const allPrices: SarjagPrice[] = [...s.prices];
  for (const c of s.connectors) {
    if (c.price) allPrices.push({ ...c.price, powerType: c.price.powerType ?? c.powerType ?? null });
  }

  const powers = s.connectors.map((c) => c.maxPowerKw).filter((n): n is number => typeof n === "number");
  const maxPowerKw = s.summary.maxPowerKw ?? (powers.length ? Math.max(...powers) : null);
  const standards = Array.from(
    new Set([...s.summary.standards, ...s.connectors.map((c) => c.standard)].map((x) => x.toUpperCase())),
  ).filter((x) => x && x !== "UNKNOWN");

  const validCoord = (n: number | null | undefined, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max ? n : null;

  return {
    uid: s.uid,
    slug: [slugify(providerId, 20), slugify(name, 60), slugify(loc.district, 30), shortHash(s.uid)]
      .filter(Boolean)
      .join("-"),
    providerId,
    externalId: s.externalId,
    code: s.code ?? null,
    name,
    operator: s.operator ?? null,
    access: s.access ?? null,
    isRoaming: s.isRoaming ?? null,
    latitude: validCoord(loc.latitude, 35, 43),
    longitude: validCoord(loc.longitude, 25, 45.5),
    address: loc.address ?? null,
    district: loc.district ?? null,
    districtSlug: slugify(loc.district) || null,
    city: province?.name ?? loc.city ?? null,
    citySlug: province?.slug ?? null,
    postalCode: loc.postalCode ?? null,
    totalConnectors: s.summary.totalConnectors || s.connectors.length,
    maxPowerKw,
    hasAc: powerTypes.has("AC"),
    hasDc: powerTypes.has("DC"),
    standards,
    minAcPrice: minPrice(allPrices, "AC"),
    minDcPrice: minPrice(allPrices, "DC"),
    connectors: s.connectors as object[],
    prices: s.prices as object[],
    isActive: true,
    sourceUpdatedAt: s.updatedAt ? new Date(s.updatedAt) : null,
  };
}

async function refreshProviderStats(providerId: string) {
  const where = { providerId, isActive: true };
  const [agg, dc, acPrices, dcPrices] = await Promise.all([
    db.station.aggregate({ where, _count: true, _sum: { totalConnectors: true }, _max: { maxPowerKw: true } }),
    db.station.count({ where: { ...where, hasDc: true } }),
    db.station.aggregate({ where: { ...where, minAcPrice: { not: null } }, _min: { minAcPrice: true }, _max: { minAcPrice: true } }),
    db.station.aggregate({ where: { ...where, minDcPrice: { not: null } }, _min: { minDcPrice: true }, _max: { minDcPrice: true } }),
  ]);
  await db.provider.update({
    where: { id: providerId },
    data: {
      stationCount: agg._count,
      dcStationCount: dc,
      connectorCount: agg._sum.totalConnectors ?? 0,
      maxPowerKw: agg._max.maxPowerKw,
      minAcPrice: acPrices._min.minAcPrice,
      maxAcPrice: acPrices._max.minAcPrice,
      minDcPrice: dcPrices._min.minDcPrice,
      maxDcPrice: dcPrices._max.minDcPrice,
    },
  });
}

/** Tek bir ağın istasyonlarını çekip veritabanına yazar. */
export async function syncProvider(providerId: string) {
  const startedAt = new Date();
  const { data } = await sarjag.stations(providerId);
  const rows = data.data.map((s) => mapStation(s, providerId));

  const CHUNK = 250;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db.$transaction(
      chunk.map((row) =>
        db.station.upsert({
          where: { uid: row.uid },
          create: { ...row, syncedAt: new Date() },
          update: { ...row, syncedAt: new Date() },
        }),
      ),
    );
  }

  // Bu senkronda gelmeyen istasyonlar pasife alınır (silinmez; SEO için 410 yerine yönlendirme yapılabilir).
  const removed = await db.station.updateMany({
    where: { providerId, isActive: true, syncedAt: { lt: startedAt } },
    data: { isActive: false },
  });

  await db.provider.update({ where: { id: providerId }, data: { lastSyncedAt: new Date(), lastSyncError: null } });
  await refreshProviderStats(providerId);
  return { upserted: rows.length, removed: removed.count };
}

/** Ağ listesini günceller ve (isteğe bağlı olarak yalnızca seçilen) ağları senkronlar. */
export async function runSync(opts: { trigger: "cron" | "manual"; providerIds?: string[] }) {
  const running = await db.syncRun.findFirst({
    where: { status: "RUNNING", startedAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (running) return { skipped: true as const, runId: running.id };

  const run = await db.syncRun.create({ data: { trigger: opts.trigger } });
  const log: string[] = [];
  let ok = 0;
  let failed = 0;
  let upserted = 0;
  let removed = 0;

  try {
    const { data: providers } = await sarjag.providers();
    for (const p of providers.data) {
      const existing = await db.provider.findUnique({ where: { id: p.id } });
      await db.provider.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          slug: slugify(p.name) || slugify(p.id),
          name: p.name,
          website: p.website ?? null,
          logoUrl: p.logoUrl ?? null,
          description: p.description ?? null,
          color: colorFor(p.id),
        },
        update: {
          name: p.name,
          website: p.website ?? existing?.website ?? null,
          description: p.description ?? existing?.description ?? null,
          logoUrl: existing?.logoUrl ?? p.logoUrl ?? null,
        },
      });
    }

    const targets = opts.providerIds?.length
      ? opts.providerIds
      : (await db.provider.findMany({ where: { isActive: true }, select: { id: true } })).map((p) => p.id);

    for (const id of targets) {
      try {
        const r = await syncProvider(id);
        ok++;
        upserted += r.upserted;
        removed += r.removed;
        log.push(`✓ ${id}: ${r.upserted} istasyon, ${r.removed} pasif`);
      } catch (e) {
        failed++;
        const msg = e instanceof SarjagError ? `${e.code}: ${e.message}` : (e as Error).message;
        log.push(`✗ ${id}: ${msg}`);
        await db.provider.update({ where: { id }, data: { lastSyncError: msg.slice(0, 500) } }).catch(() => {});
        // Bakiye bittiyse diğer ağları denemeye gerek yok.
        if (e instanceof SarjagError && (e.code === "INSUFFICIENT_TOKENS" || e.status === 401)) break;
      }
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: failed === 0 ? "SUCCESS" : ok > 0 ? "PARTIAL" : "FAILED",
        providersOk: ok,
        providersFailed: failed,
        stationsUpserted: upserted,
        stationsRemoved: removed,
        log: log.join("\n"),
        finishedAt: new Date(),
      },
    });
  } catch (e) {
    log.push(`✗ Genel hata: ${(e as Error).message}`);
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", log: log.join("\n"), finishedAt: new Date(), providersOk: ok, providersFailed: failed },
    });
  }

  revalidateTag(CACHE_TAGS.stations, "max");
  return { skipped: false as const, runId: run.id, ok, failed, upserted, removed };
}

/** Cron tarafından çağrılır: son başarılı senkrondan bu yana SYNC_INTERVAL_HOURS geçtiyse çalışır. */
export async function syncIfDue() {
  const last = await db.syncRun.findFirst({
    where: { status: { in: ["SUCCESS", "PARTIAL"] } },
    orderBy: { startedAt: "desc" },
  });
  const dueMs = env().SYNC_INTERVAL_HOURS * 60 * 60 * 1000;
  if (last && Date.now() - last.startedAt.getTime() < dueMs) return { due: false as const };
  return { due: true as const, result: await runSync({ trigger: "cron" }) };
}
