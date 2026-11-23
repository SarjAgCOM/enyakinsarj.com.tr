import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 fill-current">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.14.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5ZM14.2 6.12c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6">
      <path d="M3.6 2.3c-.3.3-.4.7-.4 1.2v17c0 .5.1.9.4 1.2l9.5-9.7-9.5-9.7Z" fill="#00D7FE" />
      <path d="m16.3 15.2-3.2-3.2-9.5 9.7c.4.4 1 .4 1.7.1l11-6.6Z" fill="#F83448" />
      <path d="m16.3 8.8-11-6.6c-.7-.4-1.3-.3-1.7.1l9.5 9.7 3.2-3.2Z" fill="#00F076" />
      <path d="m20.3 11.2-4-2.4-3.2 3.2 3.2 3.2 4-2.4c1-.6 1-1.1 0-1.6Z" fill="#FFC900" />
    </svg>
  );
}

function Badge({ href, icon, small, big }: { href: string; icon: React.ReactNode; small: string; big: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex h-12 items-center gap-3 rounded-xl bg-foreground px-4 text-background transition-[opacity,transform] duration-300 ease-smooth hover:opacity-85 active:scale-[0.98]"
    >
      {icon}
      <span className="flex flex-col text-left">
        <span className="caption-5 opacity-75">{small}</span>
        <span className="body-4">{big}</span>
      </span>
    </a>
  );
}

/** Şarjağ mobil uygulaması indirme rozetleri (App Store / Google Play). */
export function SarjagAppBadges({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Badge href={site.sarjag.appStoreUrl} icon={<AppleIcon />} small="App Store'dan" big="İndirin" />
      <Badge href={site.sarjag.playStoreUrl} icon={<PlayIcon />} small="Google Play'den" big="Edinin" />
    </div>
  );
}
