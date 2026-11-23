import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { PageHeader, Section } from "@/components/site/page-header";
import { StationCard } from "@/components/site/station-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCityTable, searchStations } from "@/server/services/stations";
import { fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İl İl Şarj İstasyonları: 81 İlde Elektrikli Araç Şarj Noktaları",
  description: "Türkiye'nin 81 ilindeki elektrikli araç şarj istasyonu sayıları, DC hızlı şarj noktaları ve il bazında şarj haritaları.",
  alternates: { canonical: "/sarj-istasyonlari" },
};

export default async function CitiesPage({ searchParams }: PageProps<"/sarj-istasyonlari">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const [cities, results] = await Promise.all([getCityTable(), q ? searchStations({ q, limit: 30 }) : Promise.resolve(null)]);
  const total = cities.reduce((a, c) => a + c.count, 0);

  return (
    <div className="mx-auto max-w-7xl px-4">
      <PageHeader
        crumbs={[{ href: "/sarj-istasyonlari", label: "İl İl İstasyonlar" }]}
        title="İl il şarj istasyonları"
        description={`Türkiye genelinde ${fmtInt(total)} halka açık şarj istasyonunun illere göre dağılımı.`}
      >
        <form className="flex max-w-xl gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            İstasyon, ilçe veya adres ara
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="İstasyon adı, ilçe veya adres ara" className="h-10" />
          <Button type="submit" size="lg" className="h-10">
            <SearchIcon data-icon="inline-start" /> Ara
          </Button>
        </form>
      </PageHeader>

      {results && (
        <Section title={`"${q}" için ${results.length} sonuç`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((s) => (
              <StationCard key={s.uid} s={s} />
            ))}
          </div>
        </Section>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-4 py-3">Plaka</th>
              <th className="px-4 py-3">İl</th>
              <th className="px-4 py-3 text-right">İstasyon</th>
              <th className="px-4 py-3 text-right">Hızlı şarj (DC)</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.slug} className="border-t">
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{String(c.plate).padStart(2, "0")}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/sarj-istasyonlari/${c.slug}`} className="font-medium hover:text-primary">
                    {c.name} şarj istasyonları
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(c.count)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(c.dc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
