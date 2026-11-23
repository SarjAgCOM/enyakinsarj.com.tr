import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kullanım Şartları",
  description: `${site.name} kullanım şartları: verilerin niteliği, sorumluluk sınırları ve kullanım koşulları.`,
  alternates: { canonical: "/kullanim-sartlari" },
};

export default function TermsPage() {
  return (
    <div className="container-page max-w-3xl">
      <PageHeader crumbs={[{ href: "/kullanim-sartlari", label: "Kullanım şartları" }]} title="Kullanım şartları" />
      <div className="prose-content">
        <p>Bu metin taslaktır. Yayına almadan önce hukuk danışmanınızla gözden geçirin.</p>
        <h2>Hizmetin kapsamı</h2>
        <p>
          {site.name}, halka açık elektrikli araç şarj istasyonlarına ilişkin konum, soket, güç ve fiyat bilgilerini
          bilgilendirme amacıyla sunar. Site üzerinden şarj başlatılamaz ve ödeme alınmaz.
        </p>
        <h2>Verilerin doğruluğu</h2>
        <p>
          Veriler üçüncü taraf bir kaynaktan düzenli olarak alınır. Fiyatlar, istasyon durumu ve doluluk bilgisi gecikmeli
          veya eksik olabilir. Yola çıkmadan önce ilgili şarj ağının uygulamasından teyit etmeniz gerekir.
        </p>
        <h2>Sorumluluk</h2>
        <p>
          Sitedeki bilgilere dayanarak verilen kararlardan doğabilecek gecikme, ek maliyet veya zararlardan site sahibi
          sorumlu tutulamaz.
        </p>
        <h2>İçerik kullanımı</h2>
        <p>
          Sitedeki metin ve görseller kaynak gösterilmeden çoğaltılamaz. Verilerin otomatik araçlarla toplu olarak
          çekilmesine izin verilmez.
        </p>
      </div>
    </div>
  );
}
