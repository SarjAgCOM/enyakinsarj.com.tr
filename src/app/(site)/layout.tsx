import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

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
