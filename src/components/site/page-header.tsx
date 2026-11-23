import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { JsonLd } from "./json-ld";

export interface Crumb {
  href: string;
  label: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ href: "/", label: "Ana sayfa" }, ...items];
  return (
    <>
      <nav aria-label="Sayfa yolu" className="caption-2 text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <CaretRightIcon aria-hidden className="size-3 opacity-60" />}
              {i === all.length - 1 ? (
                <span aria-current="page" className="text-foreground">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="transition-colors duration-300 ease-smooth hover:text-foreground">
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
    <div className={cn("flex flex-col gap-4 pb-8 pt-6", className)}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <h1 className="heading-4 max-w-3xl md:heading-3">{title}</h1>
      {description && <div className="body-3 max-w-2xl text-muted-foreground">{description}</div>}
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
    <section className={cn("py-10", className)} aria-labelledby={id}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="heading-5">
            {title}
          </h2>
          {subtitle && <p className="caption-2 max-w-2xl text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatGrid({ items }: { items: { label: string; value: React.ReactNode; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {items.map((s) => (
        <div key={s.label} className="surface-card flex flex-col gap-1 p-4 md:p-6">
          <dt className="caption-4 text-muted-foreground">{s.label}</dt>
          <dd className="heading-5 tabular-nums md:heading-4">{s.value}</dd>
          {s.hint && <dd className="caption-5 text-muted-foreground">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Boş durum: çıplak bir panel yerine ne yapılacağını söyleyen düzenli bir kutu. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-surface p-10 text-center">
      <p className="title-3">{title}</p>
      {children && <div className="body-6 flex flex-wrap justify-center gap-2 text-muted-foreground">{children}</div>}
    </div>
  );
}
