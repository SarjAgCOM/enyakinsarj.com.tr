"use client";

import { LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const enc = encodeURIComponent;
  const links = [
    { label: "X", href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium">Paylaş:</span>
      {links.map((l) => (
        <Button key={l.label} asChild variant="outline" size="sm">
          <a href={l.href} target="_blank" rel="noopener">
            {l.label}
          </a>
        </Button>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => toast.success("Bağlantı kopyalandı"));
        }}
      >
        <LinkIcon data-icon="inline-start" /> Kopyala
      </Button>
    </div>
  );
}
