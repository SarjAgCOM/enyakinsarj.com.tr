import Link from "next/link";
import { Smartphone } from "lucide-react";
import { site } from "@/lib/site";
import { Logo } from "./logo";
import { SarjagAppBadges } from "./app-badges";

const columns = [
  {
    title: "Keşfet",
    links: [
      { href: "/sarj-haritasi", label: "Şarj istasyonu haritası" },
      { href: "/sarj-aglari", label: "Şarj ağları" },
      { href: "/sarj-istasyonlari", label: "İl il şarj istasyonları" },
      { href: "/sarj-fiyatlari", label: "Şarj fiyatları" },
      { href: "/blog", label: "Blog ve rehberler" },
    ],
  },
  {
    title: "Araçlar",
    links: [
      { href: "/hesaplayicilar/sarj-maliyeti", label: "Şarj maliyeti hesaplayıcı" },
      { href: "/sarj-haritasi?yakinimda=1", label: "Bana en yakın istasyon" },
      { href: "/sarj-haritasi?dc=1", label: "DC hızlı şarj istasyonları" },
    ],
  },
  {
    title: "Kurumsal",
    links: [
      { href: "/hakkimizda", label: "Hakkımızda" },
      { href: "/iletisim", label: "İletişim" },
      { href: "/gizlilik-politikasi", label: "Gizlilik politikası" },
      { href: "/blog/rss.xml", label: "RSS" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-muted/30">
      {/* Şarjağ mobil uygulaması */}
      <section aria-labelledby="sarjag-app" className="border-b">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-10 md:grid-cols-[1fr_auto]">
          <div className="flex gap-4">
            <div className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
              <Smartphone className="size-6" />
            </div>
            <div>
              <h2 id="sarjag-app" className="text-xl font-semibold tracking-tight">
                Şarjağ mobil uygulamasıyla tüm şarj ağları cebinizde
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Her şarj noktası tek haritada: anlık soket doluluğu, kWh fiyatları ve rota planlama.{" "}
                <a href={site.sarjag.url} target="_blank" rel="noopener" className="font-medium text-primary hover:underline">
                  sarjag.com
                </a>
              </p>
            </div>
          </div>
          <SarjagAppBadges />
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Türkiye&apos;deki elektrikli araç şarj istasyonları, şarj ağları ve güncel kWh fiyatları hakkında bağımsız veri ve
            karşılaştırma platformu. Veriler{" "}
            <a href="https://console.sarjag.com" target="_blank" rel="noopener" className="underline underline-offset-2">
              Şarjağ API
            </a>{" "}
            üzerinden düzenli olarak güncellenir.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-3 text-sm font-semibold">{col.title}</h3>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} {site.domain}</p>
          <p>Fiyatlar bilgilendirme amaçlıdır; şarj öncesinde operatörün uygulamasından teyit edin.</p>
        </div>
      </div>
    </footer>
  );
}
