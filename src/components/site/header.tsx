"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CrosshairIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Üst kenardan ayrık duran, içeriğine göre boyutlanan yarı saydam navigasyon çubuğu.
 * Mobilde tam yükseklikte panel açılır; bağlantılar okuma sırasıyla girer.
 */
export function SiteHeader() {
  const pathname = usePathname();
  // Menü yalnızca açıldığı sayfada açık sayılır; sayfa değişince kendiliğinden kapanır.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenFor(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <a
        href="#main"
        className="body-5 sr-only rounded-lg bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        İçeriğe geç
      </a>

      <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border bg-background/75 p-2 backdrop-blur-xl lg:gap-6">
          <Logo className="pl-2" />

          <nav aria-label="Ana menü" className="hidden items-center lg:flex">
            {site.nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "title-4 rounded-lg px-3 py-2 transition-colors duration-300 ease-smooth",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/sarj-haritasi?yakinimda=1">
                <CrosshairIcon data-icon="inline-start" weight="bold" />
                En yakın istasyon
              </Link>
            </Button>
            <button
              type="button"
              className="relative flex size-8 items-center justify-center rounded-lg transition-colors duration-300 ease-smooth hover:bg-muted active:scale-[0.98] lg:hidden"
              aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpenFor(open ? null : pathname)}
            >
              {/* İki çizgi, açıkken çarpıya dönüşür */}
              <span
                aria-hidden
                className={cn(
                  "absolute h-0.5 w-4 rounded-full bg-foreground transition-transform duration-500 ease-smooth",
                  open ? "rotate-45" : "-translate-y-1",
                )}
              />
              <span
                aria-hidden
                className={cn(
                  "absolute h-0.5 w-4 rounded-full bg-foreground transition-transform duration-500 ease-smooth",
                  open ? "-rotate-45" : "translate-y-1",
                )}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobil menü: tam yükseklikte panel */}
      <div
        id="mobile-menu"
        data-open={open}
        inert={!open}
        className={cn(
          "fixed inset-0 z-40 flex flex-col bg-background/95 px-4 pb-8 pt-24 backdrop-blur-2xl transition-opacity duration-500 ease-smooth lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <nav aria-label="Mobil menü" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {site.nav.map((item, i) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpenFor(null)}
                style={{ transitionDelay: open ? `${Math.min(i * 60, 400)}ms` : "0ms" }}
                className={cn(
                  "nav-enter heading-5 rounded-xl px-3 py-3",
                  active ? "text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button
          asChild
          size="lg"
          className="nav-enter w-full"
          style={{ transitionDelay: open ? "400ms" : "0ms" }}
        >
          <Link href="/sarj-haritasi?yakinimda=1" onClick={() => setOpenFor(null)}>
            <CrosshairIcon data-icon="inline-start" weight="bold" />
            En yakın istasyonu bul
          </Link>
        </Button>
      </div>
    </>
  );
}
