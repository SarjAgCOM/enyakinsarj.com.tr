"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PlugZapIcon,
  Share2Icon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/logo";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Pano", icon: LayoutDashboardIcon, exact: true },
  { href: "/admin/yazilar", label: "Blog yazıları", icon: FileTextIcon },
  { href: "/admin/kategoriler", label: "Kategoriler", icon: FolderIcon },
  { href: "/admin/medya", label: "Medya", icon: ImageIcon },
  { href: "/admin/sosyal", label: "Sosyal medya", icon: Share2Icon },
  { href: "/admin/istasyonlar", label: "Şarj ağları & senkron", icon: PlugZapIcon },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: UsersIcon, adminOnly: true },
];

export function AdminSidebar({ user }: { user: { name: string; email: string; role: "ADMIN" | "EDITOR" } }) {
  const pathname = usePathname();
  return (
    <aside className="border-b bg-background lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2 px-5 py-4">
        <LogoMark className="size-7" />
        <span className="font-semibold">Yönetim</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
        {NAV.filter((n) => !n.adminOnly || user.role === "ADMIN").map((n) => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
        <Link
          href="/"
          target="_blank"
          className="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted lg:mt-auto"
        >
          <ExternalLinkIcon className="size-4" /> Siteyi görüntüle
        </Link>
      </nav>
      <div className="hidden border-t p-4 lg:block">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {user.email} · {user.role === "ADMIN" ? "Yönetici" : "Editör"}
        </p>
        <form action={logoutAction} className="mt-3">
          <Button variant="outline" size="sm" className="w-full" type="submit">
            <LogOutIcon data-icon="inline-start" /> Çıkış yap
          </Button>
        </form>
      </div>
    </aside>
  );
}
