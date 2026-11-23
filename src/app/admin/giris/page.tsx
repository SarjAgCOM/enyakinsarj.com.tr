import { LogoMark } from "@/components/site/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Giriş" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/giris">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/admin";
  return (
    <main className="flex flex-1 items-center justify-center bg-surface p-4">
      <div className="surface-card flex w-full max-w-sm flex-col gap-6 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-10" />
          <div>
            <h1 className="heading-6">Yönetim paneli</h1>
            <p className="caption-2 text-muted-foreground">Devam etmek için giriş yapın</p>
          </div>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
