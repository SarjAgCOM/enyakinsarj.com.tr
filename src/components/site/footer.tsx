import Link from "next/link";
import { DeviceMobileIcon } from "@phosphor-icons/react/ssr";
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
      { href: "/kullanim-sartlari", label: "Kullanım şartları" },
      { href: "/blog/rss.xml", label: "RSS" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-surface">
      <div className="container-page flex flex-col gap-12 py-12">
        {/* Şarjağ mobil uygulaması */}
        <section
          aria-labelledby="sarjag-app"
          className="grid items-center gap-6 rounded-3xl border bg-card p-6 md:grid-cols-[1fr_auto] md:p-8"
        >
          <div className="flex gap-4">
            <div className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground sm:flex">
              <DeviceMobileIcon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 id="sarjag-app" className="heading-6">
                Şarjağ mobil uygulamasıyla tüm şarj ağları cebinizde
              </h2>
              <p className="body-6 max-w-2xl text-muted-foreground">
                Her şarj noktası tek haritada: anlık soket doluluğu, kWh fiyatları ve rota planlama.{" "}
                <a
                  href={site.sarjag.url}
                  target="_blank"
                  rel="noopener"
                  className="body-5 text-primary underline-offset-4 hover:underline"
                >
                  sarjag.com
                </a>
              </p>
            </div>
          </div>
          <SarjagAppBadges />
        </section>

        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="body-6 max-w-sm text-muted-foreground">
              Türkiye&apos;deki elektrikli araç şarj istasyonları, şarj ağları ve güncel kWh fiyatları için bağımsız veri ve
              karşılaştırma platformu. Veriler{" "}
              <a
                href="https://console.sarjag.com"
                target="_blank"
                rel="noopener"
                className="text-foreground underline underline-offset-4"
              >
                Şarjağ API
              </a>{" "}
              üzerinden düzenli olarak güncellenir.
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
              <h3 className="title-4">{col.title}</h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="body-6 text-muted-foreground transition-colors duration-300 ease-smooth hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="caption-5 flex flex-col gap-2 text-muted-foreground md:flex-row md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.domain}
          </p>
          <p>Fiyatlar bilgilendirme amaçlıdır. Şarj öncesinde operatörün uygulamasından teyit edin.</p>
        </div>
      </div>
    </footer>
  );
}
