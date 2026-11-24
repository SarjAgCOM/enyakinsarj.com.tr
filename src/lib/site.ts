export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "En Yakın Şarj",
  domain: "enyakinsarj.com.tr",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  description:
    "Türkiye'deki tüm elektrikli araç şarj istasyonları tek haritada: şarj ağları, güncel kWh fiyatları, soket tipleri, anlık doluluk ve şarj rehberleri.",
  locale: "tr_TR",
  sarjag: {
    name: "Şarjağ",
    url: "https://sarjag.com",
    appStoreUrl:
      process.env.NEXT_PUBLIC_SARJAG_APP_STORE_URL ??
      "https://apps.apple.com/tr/app/%C5%9Farja%C4%9F-t%C3%BCm-%C5%9Farj-i-stasyonlar%C4%B1/id6834798761",
    /** App Store bağlantısındaki sayısal kimlik; iOS Safari'deki "Smart App Banner" için kullanılır. */
    get appStoreId(): string | undefined {
      return this.appStoreUrl.match(/id(\d+)/)?.[1];
    },
    // Google Play bağlantısı Şarjağ sitesinde henüz yayınlanmadığı için env'den okunur;
    // tanımlı değilse Play Store araması açılır.
    playStoreUrl:
      process.env.NEXT_PUBLIC_SARJAG_PLAY_STORE_URL ||
      "https://play.google.com/store/search?q=%C5%9Earja%C4%9F&c=apps",
  },
  nav: [
    { href: "/sarj-haritasi", label: "Harita" },
    { href: "/sarj-aglari", label: "Şarj ağları" },
    { href: "/sarj-fiyatlari", label: "Fiyatlar" },
    { href: "/sarj-istasyonlari", label: "İller" },
    { href: "/hesaplayicilar/sarj-maliyeti", label: "Hesaplayıcı" },
    { href: "/blog", label: "Blog" },
  ],
} as const;

export function absoluteUrl(path = "/") {
  // Zaten tam adres ise (ör. CDN'deki görsel) olduğu gibi döner.
  if (/^https?:\/\//i.test(path)) return path;
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
