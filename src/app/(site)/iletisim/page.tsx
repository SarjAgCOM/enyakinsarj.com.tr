import type { Metadata } from "next";
import { MailIcon } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "İletişim",
  description: `${site.name} ile iletişime geçin: veri düzeltme, iş birliği ve öneriler.`,
  alternates: { canonical: "/iletisim" },
};

export default function ContactPage() {
  const email = `info@${site.domain}`;
  return (
    <div className="mx-auto max-w-3xl px-4">
      <PageHeader
        crumbs={[{ href: "/iletisim", label: "İletişim" }]}
        title="İletişim"
        description="Hatalı bir istasyon bilgisi mi gördünüz, iş birliği mi önermek istiyorsunuz? Bize yazın."
      />
      <a href={`mailto:${email}`} className="inline-flex items-center gap-3 rounded-xl border bg-card px-5 py-4 font-medium hover:border-primary/40">
        <MailIcon className="size-5 text-primary" />
        {email}
      </a>
    </div>
  );
}
