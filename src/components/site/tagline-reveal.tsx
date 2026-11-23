"use client";

import { useEffect, useRef } from "react";

/**
 * Slogan bölümü: kelimeler, kaydırma ilerledikçe okuma sırasıyla soluk tondan tam renge geçer.
 * Tek bir scroll dinleyicisi requestAnimationFrame ile kısılır; azaltılmış hareket tercihinde
 * metin doğrudan tam renkte gösterilir (CSS).
 */
export function TaglineReveal({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = Array.from(el.querySelectorAll<HTMLElement>(".tagline-word"));
    let activated = 0;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Blok üstü ekranın %85'ine geldiğinde başlar, altı %45'ine ulaştığında tamamlanır.
      const start = vh * 0.85;
      const end = vh * 0.45;
      const progress = (start - rect.top) / (start - end + rect.height);
      const target = Math.max(0, Math.min(words.length, Math.ceil(progress * words.length)));
      // Bir kez etkinleşen kelime geri sönmez.
      while (activated < target) words[activated++].classList.add("is-active");
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <p ref={ref} className="heading-4 mx-auto max-w-170 text-center md:heading-2">
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line.split(" ").map((word, j) => (
            <span key={j} className="tagline-word">
              {word}{" "}
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}
