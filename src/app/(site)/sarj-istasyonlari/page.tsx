import type { Metadata } from "next";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
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
    <div className="container-page">
      <PageHeader
        crumbs={[{ href: "/sarj-istasyonlari", label: "İl il istasyonlar" }]}
        title="İl il şarj istasyonları"
        description={`Türkiye genelinde ${fmtInt(total)} halka açık şarj istasyonunun illere göre dağılımı.`}
      >
        <form className="flex max-w-xl gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            İstasyon, ilçe veya adres ara
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="İstasyon adı, ilçe veya adres ara" />
          <Button type="submit">
            <MagnifyingGlassIcon data-icon="inline-start" weight="bold" /> İstasyon ara
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

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Plaka</th>
              <th>İl</th>
              <th className="num">İstasyon</th>
              <th className="num">Hızlı şarj (DC)</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.slug}>
                <td className="tabular-nums text-muted-foreground">{String(c.plate).padStart(2, "0")}</td>
                <td>
                  <Link href={`/sarj-istasyonlari/${c.slug}`} className="body-5 hover:text-primary">
                    {c.name} şarj istasyonları
                  </Link>
                </td>
                <td className="num">{fmtInt(c.count)}</td>
                <td className="num">{fmtInt(c.dc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
