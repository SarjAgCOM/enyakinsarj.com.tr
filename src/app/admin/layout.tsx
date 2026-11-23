import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Yönetim Paneli", template: "%s · Yönetim" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-svh flex-col bg-background">{children}</div>;
}
