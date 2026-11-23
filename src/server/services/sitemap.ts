import "server-only";
import { getAllStationSlugs, getCityTable, listProviders } from "./stations";
import { getAllPostSlugs, listCategoriesWithCounts } from "./posts";
import { absoluteUrl } from "@/lib/site";
import { STATIONS_PER_SITEMAP } from "@/lib/sitemap-config";

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: "daily" | "weekly" | "monthly";
  priority?: number;
}

const STATIC_PAGES = [
  "/",
  "/sarj-haritasi",
  "/sarj-aglari",
  "/sarj-fiyatlari",
  "/sarj-istasyonlari",
  "/hesaplayicilar/sarj-maliyeti",
  "/blog",
  "/hakkimizda",
  "/iletisim",
];

/** Dolu olan site haritası parçalarının kimlikleri: 0 = sayfalar, 1… = istasyonlar. */
export async function sitemapIds(): Promise<number[]> {
  const stations = await getAllStationSlugs().catch(() => []);
  const stationParts = Math.ceil(stations.length / STATIONS_PER_SITEMAP);
  return [0, ...Array.from({ length: stationParts }, (_, i) => i + 1)];
}

export async function sitemapEntries(id: number): Promise<SitemapEntry[]> {
  const now = new Date();
  if (id === 0) {
    const [providers, cities, posts, categories] = await Promise.all([
      listProviders(),
      getCityTable(),
      getAllPostSlugs(),
      listCategoriesWithCounts(),
    ]);
    return [
      ...STATIC_PAGES.map((p) => ({ url: absoluteUrl(p), lastModified: now, changeFrequency: "daily" as const, priority: p === "/" ? 1 : 0.8 })),
      ...providers.map((p) => ({ url: absoluteUrl(`/sarj-aglari/${p.slug}`), lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
      ...cities
        .filter((c) => c.count > 0)
        .map((c) => ({ url: absoluteUrl(`/sarj-istasyonlari/${c.slug}`), lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
      ...categories
        .filter((c) => c.count > 0)
        .map((c) => ({ url: absoluteUrl(`/blog/kategori/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.5 })),
      ...posts.map((p) => ({ url: absoluteUrl(`/blog/${p.slug}`), lastModified: new Date(p.updatedAt), changeFrequency: "monthly" as const, priority: 0.7 })),
    ];
  }
  const stations = await getAllStationSlugs();
  return stations.slice((id - 1) * STATIONS_PER_SITEMAP, id * STATIONS_PER_SITEMAP).map((s) => ({
    url: absoluteUrl(`/istasyon/${s.slug}`),
    lastModified: new Date(s.syncedAt),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderUrlset(entries: SitemapEntry[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `<url><loc>${esc(e.url)}</loc>` +
      (e.lastModified ? `<lastmod>${e.lastModified.toISOString()}</lastmod>` : "") +
      (e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : "") +
      (e.priority != null ? `<priority>${e.priority}</priority>` : "") +
      "</url>",
  )
  .join("\n")}
</urlset>`;
}

export function renderSitemapIndex(ids: number[]) {
  const lastmod = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ids.map((id) => `<sitemap><loc>${absoluteUrl(`/sitemap/${id}.xml`)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;
}
