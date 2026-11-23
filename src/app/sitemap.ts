import type { MetadataRoute } from "next";
import { getAllStationSlugs, getCityTable, listProviders } from "@/server/services/stations";
import { getAllPostSlugs, listCategoriesWithCounts } from "@/server/services/posts";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Site haritası parçaları: 0 = sayfalar/ağlar/iller/blog, 1.. = istasyonlar (40.000'lik dilimler).
 * Next.js, /sitemap/0.xml … adreslerini ve bir sitemap index üretir.
 */
const STATIONS_PER_SITEMAP = 40_000;

export async function generateSitemaps() {
  // Build sırasında DB olmadığı için parça sayısı sabittir: 0 = sayfalar, 1-3 = istasyonlar (120.000'e kadar).
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const now = new Date();

  if (id === 0) {
    const [providers, cities, posts, categories] = await Promise.all([
      listProviders(),
      getCityTable(),
      getAllPostSlugs(),
      listCategoriesWithCounts(),
    ]);
    const statics = ["/", "/sarj-haritasi", "/sarj-aglari", "/sarj-fiyatlari", "/sarj-istasyonlari", "/hesaplayicilar/sarj-maliyeti", "/blog", "/hakkimizda", "/iletisim"];
    return [
      ...statics.map((p) => ({ url: absoluteUrl(p), lastModified: now, changeFrequency: "daily" as const, priority: p === "/" ? 1 : 0.8 })),
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
  return stations
    .slice((id - 1) * STATIONS_PER_SITEMAP, id * STATIONS_PER_SITEMAP)
    .map((s) => ({ url: absoluteUrl(`/istasyon/${s.slug}`), lastModified: new Date(s.syncedAt), changeFrequency: "weekly", priority: 0.5 }));
}
