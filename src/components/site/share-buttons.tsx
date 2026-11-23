"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const links = [
    { label: "X", href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="title-4 mr-1">Yazıyı paylaş</span>
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
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          });
        }}
      >
        {copied ? <CheckIcon data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
        {copied ? "Bağlantı kopyalandı" : "Bağlantıyı kopyala"}
      </Button>
    </div>
  );
}
