# enyakinsarj.com.tr

Türkiye'deki tüm elektrikli araç şarj istasyonlarını tek haritada gösteren, şarj ağlarına özel haritaları, kWh fiyat
karşılaştırması, yapay zekâ destekli arama ve blog/yönetim paneli içeren Next.js uygulaması.

İstasyon verisi **[Şarjağ API](https://console.sarjag.com)** üzerinden alınır, kendi PostgreSQL veritabanına senkronlanır
ve site trafiği Şarjağ'a değil veritabanına gider (token tasarrufu + hız).

## Teknolojiler

| Katman | Kullanılan |
|---|---|
| Uygulama | Next.js 16 (App Router), React 19, TypeScript |
| API | tRPC v11 + zod v4 (girdi ve Şarjağ yanıt doğrulaması), superjson |
| Veritabanı | PostgreSQL 17 + Prisma 7 (`@prisma/adapter-pg`) |
| Arayüz | shadcn/ui (Radix), Tailwind CSS v4, Phosphor ikonları, MapLibre GL (OpenFreeMap karoları) |
| Yapay zekâ | Ücretsiz OpenAI uyumlu servisler (Gemini, Groq, OpenRouter) veya Claude; zod ile doğrulanan yapılandırılmış çıktı |
| Görseller | Oracle Cloud Object Storage (S3 uyumluluk API'si) |
| Sosyal medya | X API v2 (OAuth 1.0a), Instagram Graph API |
| Çalıştırma | Docker Compose: `db`, `migrate`, `app`, `cron` |

## Özellikler

**Site**
- `/sarj-haritasi` — tüm istasyonlar, kümeleme, ağ / soket (CCS, Type 2, CHAdeMO) / en az güç filtresi, “bana en yakın”
- `/sarj-aglari/[ag]` — her şarj ağının **kendi istasyon haritası**, soket dağılımı, fiyat aralığı, il listesi, AI ile üretilmiş SEO metni
- `/sarj-istasyonlari/[il]` — 81 il sayfası: harita, ağ ve ilçe tabloları, en hızlı istasyonlar
- `/istasyon/[slug]` — istasyon detayı, soketler, tarifeler, **anlık doluluk** (Şarjağ status), yakındaki istasyonlar
- `/sarj-fiyatlari`, `/hesaplayicilar/sarj-maliyeti`, `/blog`, `/blog/[slug]`, `/blog/kategori/[slug]`
- Ana sayfada **yapay zekâ destekli doğal dil araması** (“Kadıköy'de 150 kW üstü Trugo”)
- Footer'da **Şarjağ mobil uygulaması** App Store / Google Play rozetleri

**SEO**
- Sayfa bazlı dinamik `title`/`description`/canonical, Open Graph, Twitter kartları
- JSON-LD: WebSite + SearchAction, Organization, BreadcrumbList, BlogPosting, FAQPage, Place, ItemList
- Bölünmüş `sitemap` (`/sitemap/0.xml` …), `robots.txt`, RSS (`/blog/rss.xml`), `llms.txt`, OG görseli, manifest

**Yönetim paneli (`/admin`)**
- Pano: istasyon/yazı istatistikleri, Şarjağ token bakiyesi, kurulum kontrol listesi
- Blog editörü: markdown + önizleme, **AI ile yazı oluşturma** (güncel istasyon/fiyat verisiyle), AI SEO meta, AI sosyal medya metni, Google önizlemesi, planlı yayın
- Medya kütüphanesi: **Oracle bucket'a yükleme**
- Sosyal medya: X ve Instagram hesap bağlama (şifreli saklama), şablonlar, **yayınlanınca otomatik paylaşım**, paylaşım geçmişi
- Şarj ağları: manuel/otomatik Şarjağ senkronu, ağ düzenleme (renk, logo, AI SEO metni)
- Kullanıcılar: yönetici/editör rolleri

## Veri koruması (kazımaya karşı)

İstasyon verisinin yalnızca sitenin kendi arayüzünden okunabilmesi için (`src/server/guard.ts`, `src/trpc/secure-fetch.ts`):

- **Oturum jetonu:** tarayıcı önce `/api/session`'dan 30 dakikalık imzalı bir jeton ve AES anahtarı alır. Oturum yalnızca
  aynı kaynaktan gelen tarayıcı isteklerine verilir ve jeton alındığı tarayıcıya (User-Agent) bağlıdır.
- **Şifreli taşıma:** `/api/trpc` yalnızca POST kabul eder; istek gövdesi ve yanıt AES-256-GCM ile şifrelidir. Ağ sekmesinde
  istasyon, soket durumu veya arama verisi düz metin olarak görünmez; kopyalanan bir istek jetonun süresi dolunca çalışmaz.
- **Hız sınırları (IP başına):** tRPC 240/dk, harita noktaları 20/dk, istasyon ayrıntısı 60/dk, arama 40/dk, anlık durum 20/dk,
  oturum 40/saat, `/istasyon/*` sayfaları 120/dk.
- **Şarjağ API anahtarı** hiçbir zaman tarayıcıya gönderilmez.

Sınırlar: anahtar tarayıcıya verilmek zorunda olduğu için bu katman kararlı bir saldırganı durdurmaz, toplu veri çekmeyi
zorlaştırır ve yavaşlatır. Arama motorlarının okuması gereken HTML sayfaları ve site haritası (SEO) doğası gereği herkese
açıktır. Daha güçlü koruma için önüne bot yönetimi olan bir CDN / WAF (ör. Cloudflare) konabilir.

## Tasarım sistemi

Kurallar `src/app/globals.css` içinde tanımlıdır:

- **Yazı:** tek yazı tipi (Geist). Metinler adlandırılmış stilleri kullanır: `heading-1…6`, `title-1…5`, `body-1…6`,
  `button-lg/md/sm/xsm`, `caption-1…5`. Serbest `text-*` + `font-*` kombinasyonu yerine bunları kullanın.
- **Boşluk:** yalnızca 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px (Tailwind `0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24`).
- **Yüzeyler:** düz arka planlar, `surface-card` / `surface-card-interactive`, tablolar için `data-table`, etiketler için `chip`.
- **Hareket:** tek eğri `ease-smooth` (`cubic-bezier(0.22, 1, 0.36, 1)`); `Reveal` (kaydırınca belirme) ve `TaglineReveal` bileşenleri.
- **Tema:** açık ve koyu tema (`ThemeToggle`); koyu yüzeyler `#181818`, `#1F1F1F`, `#272727`, `#313131`.
- **İkonlar:** `@phosphor-icons/react/ssr`.

## Hızlı başlangıç (geliştirme)

```bash
cp .env.example .env          # değerleri doldurun (APP_SECRET, CRON_SECRET, ADMIN_PASSWORD, SARJAG_API_KEY …)
npm install
docker compose up -d db       # yalnızca PostgreSQL
npm run db:deploy             # migration'ları uygula
npm run db:seed               # yönetici + varsayılan kategoriler
npm run dev                   # http://localhost:3000
```

İlk istasyon verisi için `/admin/istasyonlar` → **Tüm ağları senkronla**.

## Docker ile production

```bash
cp .env.example .env    # NEXT_PUBLIC_SITE_URL=https://enyakinsarj.com.tr vb.
docker compose up -d --build
```

- `migrate` servisi migration + seed çalıştırıp çıkar, ardından `app` başlar.
- `cron` servisi 5 dakikada bir `POST /api/cron` çağırır: planlı yazıları yayınlar (+otomatik paylaşım) ve
  `SYNC_INTERVAL_HOURS` dolduysa Şarjağ senkronunu çalıştırır.
- `docker-compose.yml` host'a port açmaz; önüne TLS sonlandıran bir reverse proxy (Caddy / Nginx / Traefik) koyun.
  Yerelde `docker compose up` ayrıca `docker-compose.override.yml` dosyasını yükler ve 3000 / 5432 portlarını açar.

### Coolify

1. Kaynak türü **Docker Compose**, compose dosyası `docker-compose.yml`.
2. `app` servisine alan adını port ile verin: `https://enyakinsarj.com.tr:3000` (Traefik konteynerin 3000 portuna yönlendirir).
3. Ortam değişkenlerini Coolify arayüzünden girin: en az `POSTGRES_PASSWORD`, `APP_SECRET`, `CRON_SECRET`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL` (build-time), `SARJAG_API_KEY`.
4. `DATABASE_URL` girmeniz gerekmez: bağlantı `POSTGRES_*` değerlerinden kurulur, şifrede özel karakter olabilir.

**Şifre değişikliği:** PostgreSQL, `POSTGRES_PASSWORD` değerini yalnızca volume ilk oluşturulurken okur. Değeri
sonradan değiştirirseniz `migrate` servisi bunu algılar ve veritabanındaki şifreyi yeni değerle eşitler
(`scripts/db-check.mjs`, db ile paylaşılan yerel soket üzerinden; veri silinmez). `POSTGRES_USER` ve `POSTGRES_DB`
ise ilk kurulumdan sonra değiştirilmemelidir.

**`migrate` servisi `exit 1` ile biterse** asıl mesaj deploy logunda değil, `migrate` konteynerinin logundadır.

## Ortam değişkenleri

Tamamı `.env.example` içinde açıklamalıdır. Önemli olanlar:

| Değişken | Açıklama |
|---|---|
| `SARJAG_API_KEY` | console.sarjag.com → Proje → API anahtarı (`sk_live_…`). Yalnızca sunucuda kullanılır. |
| `APP_SECRET` | Oturum imzası ve sosyal medya kimlik bilgilerinin şifrelenmesi (≥32 karakter) |
| `CRON_SECRET` | `/api/cron` yetkilendirmesi |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | Yapay zekâ: `gemini` / `groq` / `openrouter` (ücretsiz katman) veya `anthropic` + `ANTHROPIC_API_KEY`. Ayrıntı `.env.example` içinde |
| `OCI_*` | Oracle Object Storage: namespace, region, bucket, Customer Secret Key; bucket görselleri herkese açık olmalı (Instagram ve site için) |
| `NEXT_PUBLIC_SARJAG_PLAY_STORE_URL` | Şarjağ Android uygulama bağlantısı (boşsa Play Store araması açılır) |

## Oracle Object Storage kurulumu

1. OCI Konsol → Object Storage → bucket oluşturun, **Visibility: Public** yapın.
2. Profil → **Customer Secret Keys** → yeni anahtar; Access Key ve Secret'ı `OCI_ACCESS_KEY_ID` / `OCI_SECRET_ACCESS_KEY` olarak girin.
3. `OCI_NAMESPACE` (Tenancy → Object Storage Namespace), `OCI_REGION`, `OCI_BUCKET` değerlerini doldurun.

## Proje yapısı

```
prisma/                 şema, migration'lar, seed
src/app/(site)/         herkese açık sayfalar
src/app/admin/          yönetim paneli (giriş + (panel) grubu)
src/app/api/            tRPC, cron, yükleme, sağlık kontrolü
src/server/api/         tRPC router'ları (public + admin)
src/server/sarjag/      Şarjağ API istemcisi + zod şemaları
src/server/services/    senkron, istasyon sorguları, blog servisleri
src/server/social/      X ve Instagram paylaşımı
src/server/ai.ts        Claude ile arama, yazı, SEO ve sosyal medya metni üretimi
src/server/storage.ts   Oracle Object Storage
src/components/         site, harita ve admin bileşenleri (shadcn/ui)
```
