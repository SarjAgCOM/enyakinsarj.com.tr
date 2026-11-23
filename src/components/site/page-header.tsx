import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { JsonLd } from "./json-ld";

export interface Crumb {
  href: string;
  label: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ href: "/", label: "Ana Sayfa" }, ...items];
  return (
    <>
      <nav aria-label="Sayfa yolu" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRightIcon className="size-3.5 opacity-60" />}
              {i === all.length - 1 ? (
                <span aria-current="page" className="text-foreground">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="hover:text-foreground">
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            item: absoluteUrl(c.href),
          })),
        }}
      />
    </>
  );
}

export function PageHeader({
  crumbs,
  title,
  description,
  children,
  className,
}: {
  crumbs?: Crumb[];
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 pb-6 pt-8", className)}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">{title}</h1>
      {description && <p className="max-w-3xl text-base text-muted-foreground md:text-lg">{description}</p>}
      {children}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  action,
  children,
  className,
  id,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={cn("py-8", className)} aria-labelledby={id}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id={id} className="text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatGrid({ items }: { items: { label: string; value: React.ReactNode; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-xl border bg-card p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
          {s.hint && <dd className="mt-0.5 text-xs text-muted-foreground">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
