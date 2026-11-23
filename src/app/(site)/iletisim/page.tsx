import type { Metadata } from "next";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/ssr";
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
    <div className="container-page max-w-3xl">
      <PageHeader
        crumbs={[{ href: "/iletisim", label: "İletişim" }]}
        title="İletişim"
        description="Hatalı bir istasyon bilgisi mi gördünüz, iş birliği mi önermek istiyorsunuz? Bize yazın."
      />
      <a href={`mailto:${email}`} className="surface-card-interactive body-2 inline-flex items-center gap-3 px-6 py-4">
        <EnvelopeSimpleIcon className="size-5 text-primary" />
        {email}
      </a>
    </div>
  );
}
