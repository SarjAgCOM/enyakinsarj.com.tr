import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <LogoMark className="size-12" />
      <h1 className="text-3xl font-bold">Sayfa bulunamadı</h1>
      <p className="max-w-md text-muted-foreground">
        Aradığınız sayfa taşınmış ya da kaldırılmış olabilir. Şarj haritasından en yakın istasyonu bulabilirsiniz.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/sarj-haritasi">Şarj haritası</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ana sayfa</Link>
        </Button>
      </div>
    </main>
  );
}
