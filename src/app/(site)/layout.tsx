import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { site } from "@/lib/site";

// iOS Safari'de sayfanın en üstünde Şarjağ uygulamasının indirme şeridini (Smart App Banner) gösterir:
// <meta name="apple-itunes-app" content="app-id=…">
export const metadata: Metadata = site.sarjag.appStoreId ? { itunes: { appId: site.sarjag.appStoreId } } : {};

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {/* Üstteki yüzen navigasyon için boşluk */}
      <main id="main" className="flex-1 pt-24">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
