import { LogoMark } from "@/components/site/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Giriş" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/giris">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/admin";
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-10" />
          <div>
            <h1 className="text-xl font-semibold">Yönetim paneli</h1>
            <p className="text-sm text-muted-foreground">Devam etmek için giriş yapın</p>
          </div>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
