import type { MetadataRoute } from "next";
import { absoluteUrl, site } from "@/lib/site";
import { generateSitemaps } from "./sitemap";
import { getAllStationSlugs } from "@/server/services/stations";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Boş istasyon parçalarını listelemeyelim
  const stations = await getAllStationSlugs().catch(() => []);
  const parts = (await generateSitemaps()).filter((p) => p.id === 0 || (p.id - 1) * 40_000 < stations.length);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    // generateSitemaps ile bölünmüş site haritaları: /sitemap/0.xml, /sitemap/1.xml …
    sitemap: parts.map((p) => absoluteUrl(`/sitemap/${p.id}.xml`)),
    host: site.url,
  };
}
