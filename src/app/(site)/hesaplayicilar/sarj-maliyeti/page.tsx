import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/site/page-header";
import { CostCalculator } from "@/components/site/cost-calculator";
import { JsonLd } from "@/components/site/json-ld";
import { getPriceTable } from "@/server/services/stations";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Şarj Maliyeti Hesaplayıcı: Elektrikli Araç Şarjı Kaç TL?",
  description:
    "Elektrikli aracınızın bir şarjının ve 100 km'sinin kaç TL tuttuğunu güncel şarj ağı fiyatlarıyla hesaplayın; benzinli araçla karşılaştırın.",
  alternates: { canonical: "/hesaplayicilar/sarj-maliyeti" },
};

export default async function CostCalculatorPage() {
  const prices = await getPriceTable();
  return (
    <div className="mx-auto max-w-7xl px-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Şarj maliyeti hesaplayıcı",
          url: absoluteUrl("/hesaplayicilar/sarj-maliyeti"),
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "TRY" },
        }}
      />
      <PageHeader
        crumbs={[{ href: "/hesaplayicilar/sarj-maliyeti", label: "Şarj Maliyeti Hesaplayıcı" }]}
        title="Şarj maliyeti hesaplayıcı"
        description="Batarya kapasitesi, şarj aralığı ve şarj ağına göre bir şarjın maliyetini, kazanılan menzili ve benzine göre tasarrufunuzu hesaplayın."
      />
      <CostCalculator
        providers={prices.map((p) => ({ id: p.id, name: p.name, minAcPrice: p.minAcPrice, minDcPrice: p.minDcPrice }))}
      />
      <Section title="Nasıl hesaplanır?">
        <div className="prose-content max-w-3xl">
          <p>
            Bataryaya giren enerji = batarya kapasitesi × (hedef şarj − başlangıç şarjı). Şarj sırasında enerjinin bir kısmı ısı
            olarak kaybolduğu için şebekeden çekilen enerji biraz daha fazladır: DC şarjda yaklaşık %8, AC şarjda yaklaşık %12
            kayıp varsayılır. Maliyet, şebekeden çekilen enerji ile kWh fiyatının çarpımıdır.
          </p>
          <p>
            Kış aylarında, otoyol hızlarında ve klima kullanımında tüketim artar; gerçek değerler sürüş koşullarına göre değişir.
          </p>
        </div>
      </Section>
    </div>
  );
}
