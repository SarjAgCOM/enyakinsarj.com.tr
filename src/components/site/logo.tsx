import Link from "next/link";
import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M17.6 5 9 18h6l-1.6 9L23 13.5h-6.2L17.6 5Z" className="fill-primary-foreground" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)} aria-label={`${site.name} ana sayfa`}>
      <LogoMark />
      <span className="text-lg">
        En Yakın <span className="text-primary">Şarj</span>
      </span>
    </Link>
  );
}
