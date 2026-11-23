import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <LogoMark className="size-12" />
      <div className="flex flex-col gap-3">
        <p className="caption-1 text-primary">Hata 404</p>
        <h1 className="heading-4 md:heading-3">Aradığınız sayfa burada değil</h1>
        <p className="body-3 max-w-md text-muted-foreground">
          Sayfa taşınmış ya da kaldırılmış olabilir. Şarj haritasından en yakın istasyonu bulabilirsiniz.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/sarj-haritasi">Şarj haritasını aç</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ana sayfaya dön</Link>
        </Button>
      </div>
    </main>
  );
}
