"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowSquareOutIcon, FileTextIcon, FolderIcon, ImageIcon, PlugChargingIcon, RssIcon, ShareNetworkIcon, SignOutIcon, SparkleIcon, SquaresFourIcon, UsersIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/logo";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Pano", icon: SquaresFourIcon, exact: true },
  { href: "/admin/yazilar", label: "Blog yazıları", icon: FileTextIcon },
  { href: "/admin/haberler", label: "Haber akışı", icon: RssIcon },
  { href: "/admin/kategoriler", label: "Kategoriler", icon: FolderIcon },
  { href: "/admin/medya", label: "Medya", icon: ImageIcon },
  { href: "/admin/sosyal", label: "Sosyal medya", icon: ShareNetworkIcon },
  { href: "/admin/istasyonlar", label: "Şarj ağları ve senkron", icon: PlugChargingIcon },
  { href: "/admin/yapay-zeka", label: "Yapay zekâ", icon: SparkleIcon, adminOnly: true },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: UsersIcon, adminOnly: true },
];

export function AdminSidebar({ user }: { user: { name: string; email: string; role: "ADMIN" | "EDITOR" } }) {
  const pathname = usePathname();
  return (
    <aside className="bg-surface lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-64 lg:flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <LogoMark className="size-8" />
        <span className="body-1">Yönetim</span>
      </div>
      <nav aria-label="Yönetim menüsü" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible">
        {NAV.filter((n) => !n.adminOnly || user.role === "ADMIN").map((n) => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "title-4 flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-300 ease-smooth",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <n.icon className="size-4" weight={active ? "fill" : "regular"} />
              {n.label}
            </Link>
          );
        })}
        <Link
          href="/"
          target="_blank"
          className="title-4 flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-300 ease-smooth hover:bg-muted hover:text-foreground lg:mt-auto"
        >
          <ArrowSquareOutIcon className="size-4" /> Siteyi görüntüle
        </Link>
      </nav>
      <div className="hidden flex-col gap-3 p-4 lg:flex">
        <div className="flex flex-col">
          <p className="title-4 truncate">{user.name}</p>
          <p className="caption-5 truncate text-muted-foreground">
            {user.email} · {user.role === "ADMIN" ? "Yönetici" : "Editör"}
          </p>
        </div>
        <form action={logoutAction}>
          <Button variant="outline" size="sm" className="w-full" type="submit">
            <SignOutIcon data-icon="inline-start" /> Çıkış yap
          </Button>
        </form>
      </div>
    </aside>
  );
}
