import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description: `${site.name} gizlilik politikası ve kişisel verilerin işlenmesi.`,
  alternates: { canonical: "/gizlilik-politikasi" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <PageHeader crumbs={[{ href: "/gizlilik-politikasi", label: "Gizlilik Politikası" }]} title="Gizlilik politikası" />
      <div className="prose-content">
        <p>
          Bu metin taslaktır; yayına almadan önce hukuk danışmanınızla KVKK uyumlu hâle getirin.
        </p>
        <h2>Konum verisi</h2>
        <p>
          “Bana en yakın istasyonlar” özelliğini kullandığınızda konumunuz yalnızca tarayıcınızda izninizle alınır, size en
          yakın istasyonları hesaplamak için anlık olarak kullanılır ve saklanmaz.
        </p>
        <h2>Yapay zekâ destekli arama</h2>
        <p>
          Arama kutusuna yazdığınız metin, filtrelere dönüştürülmek üzere yapay zekâ hizmet sağlayıcısına iletilir. Arama
          metinlerine kişisel veri yazmamanızı öneririz.
        </p>
        <h2>Çerezler</h2>
        <p>Site yalnızca yönetim paneli oturumu için zorunlu bir çerez kullanır; ziyaretçi takibi için çerez kullanılmaz.</p>
      </div>
    </div>
  );
}
