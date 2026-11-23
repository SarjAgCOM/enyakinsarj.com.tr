import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description: `${site.name}, Türkiye'deki elektrikli araç şarj istasyonlarını, şarj ağlarını ve fiyatlarını tek yerde sunan bağımsız bir platformdur.`,
  alternates: { canonical: "/hakkimizda" },
};

export default function AboutPage() {
  return (
    <div className="container-page max-w-3xl">
      <PageHeader crumbs={[{ href: "/hakkimizda", label: "Hakkımızda" }]} title="Hakkımızda" />
      <div className="prose-content">
        <p>
          <strong>{site.name}</strong>, elektrikli araç sürücülerinin en yakın ve en uygun şarj istasyonunu hızla bulabilmesi
          için kuruldu. Türkiye&apos;deki şarj ağlarının istasyonlarını, soket tiplerini, güçlerini ve kWh fiyatlarını tek bir
          haritada topluyoruz.
        </p>
        <h2>Veri kaynağımız</h2>
        <p>
          İstasyon, soket, fiyat ve anlık doluluk verileri{" "}
          <a href="https://console.sarjag.com" target="_blank" rel="noopener">
            Şarjağ API
          </a>{" "}
          üzerinden alınır ve düzenli olarak güncellenir. Fiyatlar bilgilendirme amaçlıdır; şarj öncesinde ilgili şarj ağının
          uygulamasından teyit etmenizi öneririz.
        </p>
        <h2>Bağımsızlık</h2>
        <p>
          Hiçbir şarj ağıyla ticari bir bağımız yoktur. Sıralamalar istasyon sayısı, güç ve fiyat gibi nesnel ölçütlere göre
          yapılır.
        </p>
      </div>
    </div>
  );
}
