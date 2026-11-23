import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { AdminSidebar } from "@/components/admin/sidebar";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/giris");
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <AdminSidebar user={user} />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
