import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/site/page-header";
import { ProviderDot } from "@/components/site/station-card";
import { JsonLd } from "@/components/site/json-ld";
import { getPriceTable, getStats } from "@/server/services/stations";
import { AVG_KWH_PER_100KM, costPer100Km, fmtDate, fmtTl, monthYear } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const prices = await getPriceTable();
  const names = prices
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ");
  const my = monthYear();
  return {
    title: `Şarj İstasyonu Fiyatları ${my}: ${names} kWh Ücretleri`,
    description: `${my} güncel elektrikli araç şarj fiyatları: ${prices.length} şarj ağının AC ve DC kWh ücretleri, 100 km şarj maliyeti karşılaştırması.`,
    alternates: { canonical: "/sarj-fiyatlari" },
  };
}

export default async function PricesPage() {
  const [prices, stats] = await Promise.all([getPriceTable(), getStats()]);
  const byAc = [...prices].filter((p) => p.minAcPrice != null).sort((a, b) => a.minAcPrice! - b.minAcPrice!);
  const byDc = prices.filter((p) => p.minDcPrice != null);

  return (
    <div className="mx-auto max-w-7xl px-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Table",
          about: `Türkiye elektrikli araç şarj fiyatları (${monthYear()})`,
        }}
      />
      <PageHeader
        crumbs={[{ href: "/sarj-fiyatlari", label: "Şarj Fiyatları" }]}
        title={`Şarj istasyonu fiyatları (${monthYear()})`}
        description="Şarj ağlarının istasyon verilerinden derlenen en düşük ve en yüksek kWh ücretleri (KDV dahil). DC fiyatları lokasyon ve güce göre değişebilir."
      />

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Şarj ağı</th>
              <th className="px-4 py-3 font-semibold">AC (₺/kWh)</th>
              <th className="px-4 py-3 font-semibold">DC (₺/kWh)</th>
              <th className="px-4 py-3 font-semibold">100 km DC maliyeti</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3">
                  <Link href={`/sarj-aglari/${p.slug}`} className="flex items-center gap-2 font-medium hover:text-primary" title={`${p.name} şarj ücretleri`}>
                    <ProviderDot color={p.color} /> {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {fmtTl(p.minAcPrice)}
                  {p.maxAcPrice && p.minAcPrice && p.maxAcPrice > p.minAcPrice ? ` – ${fmtTl(p.maxAcPrice)}` : ""}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {fmtTl(p.minDcPrice)}
                  {p.maxDcPrice && p.minDcPrice && p.maxDcPrice > p.minDcPrice ? ` – ${fmtTl(p.maxDcPrice)}` : ""}
                </td>
                <td className="px-4 py-3 tabular-nums">{fmtTl(costPer100Km(p.minDcPrice))}</td>
              </tr>
            ))}
            {prices.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Henüz fiyat verisi yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        100 km maliyeti en düşük DC fiyatı ve ortalama {AVG_KWH_PER_100KM} kWh/100 km tüketimle hesaplanır. Son güncelleme:{" "}
        {fmtDate(stats.lastSyncedAt)}. Abonelik paketleri dahil değildir.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="En ucuz DC hızlı şarj">
          <ol className="space-y-2">
            {byDc.slice(0, 5).map((p, i) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <span className="flex items-center gap-3">
                  <span className="w-5 text-muted-foreground">{i + 1}.</span>
                  <ProviderDot color={p.color} /> {p.name}
                </span>
                <span className="font-semibold tabular-nums">{fmtTl(p.minDcPrice)}</span>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="En ucuz AC şarj">
          <ol className="space-y-2">
            {byAc.slice(0, 5).map((p, i) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <span className="flex items-center gap-3">
                  <span className="w-5 text-muted-foreground">{i + 1}.</span>
                  <ProviderDot color={p.color} /> {p.name}
                </span>
                <span className="font-semibold tabular-nums">{fmtTl(p.minAcPrice)}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <Section title="Kendi maliyetinizi hesaplayın">
        <p className="text-muted-foreground">
          Aracınızın batarya kapasitesi ve tüketimine göre bir şarjın kaç TL tuttuğunu ve benzine göre tasarrufunuzu{" "}
          <Link href="/hesaplayicilar/sarj-maliyeti" className="font-medium text-primary underline underline-offset-4">
            şarj maliyeti hesaplayıcısı
          </Link>{" "}
          ile görün.
        </p>
      </Section>
    </div>
  );
}
