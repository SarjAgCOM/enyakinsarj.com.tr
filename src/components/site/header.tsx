import Link from "next/link";
import { MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50">
        İçeriğe geç
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Logo />
        <nav aria-label="Ana menü" className="hidden flex-1 items-center gap-1 lg:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="lg" className="hidden sm:inline-flex">
            <Link href="/sarj-haritasi?yakinimda=1">
              <MapPinIcon data-icon="inline-start" />
              En yakın istasyon
            </Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
