"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MagnifyingGlassIcon, SparkleIcon } from "@phosphor-icons/react/ssr";
import { useTRPC } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { StationCard, StationCardSkeleton } from "./station-card";

const EXAMPLES = ["Bana en yakın 150 kW üstü şarj", "Kadıköy'de ZES istasyonları", "Ankara'da en ucuz DC şarj"];

function getLocation(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(undefined),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** Doğal dilde istasyon araması (Claude ile filtrelere çevrilir). */
export function AiSearch() {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const search = useMutation(trpc.ai.search.mutationOptions());

  async function run(q: string) {
    const text = q.trim();
    setNotice(null);
    if (text.length < 3) {
      setNotice("Aramak için en az üç karakter yazın.");
      return;
    }
    setQuery(text);
    const wantsLocation = /yakın|yanımda|civar|etraf|konum/i.test(text);
    const location = wantsLocation ? await getLocation() : undefined;
    const res = await search.mutateAsync({ query: text, location }).catch(() => null);
    if (res?.needsLocation && !location) {
      const loc = await getLocation();
      if (loc) search.mutate({ query: text, location: loc });
      else setNotice("Konum izni verilmedi. İl veya ilçe adı yazarak arayabilirsiniz.");
    }
  }

  return (
    <div className="w-full">
      <form
        role="search"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        className="flex w-full items-center gap-2 rounded-2xl border bg-card p-2 transition-[border-color,box-shadow] duration-300 ease-smooth focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
      >
        <SparkleIcon aria-hidden weight="fill" className="ml-2 size-5 shrink-0 text-primary" />
        <label htmlFor="ai-search" className="sr-only">
          Şarj istasyonu ara
        </label>
        <input
          id="ai-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İl, ilçe, ağ adı veya ihtiyacınızı yazın"
          className="body-3 h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          maxLength={300}
          autoComplete="off"
          aria-describedby={notice || search.error ? "ai-search-message" : undefined}
        />
        <Button type="submit" disabled={search.isPending}>
          <MagnifyingGlassIcon weight="bold" />
          <span className="hidden sm:inline">{search.isPending ? "Aranıyor" : "İstasyon bul"}</span>
        </Button>
      </form>

      {(notice || search.error) && (
        <p id="ai-search-message" role="alert" className="caption-2 mt-2 text-left text-destructive">
          {notice ?? search.error?.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => void run(ex)} className="chip caption-2 text-muted-foreground">
            {ex}
          </button>
        ))}
      </div>

      {search.isPending && (
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3" aria-label="Sonuçlar yükleniyor">
          {Array.from({ length: 3 }).map((_, i) => (
            <StationCardSkeleton key={i} />
          ))}
        </div>
      )}

      {search.data && !search.isPending && (
        <div className="mt-8 flex flex-col gap-3 text-left" aria-live="polite">
          <p className="caption-2 flex flex-wrap items-center gap-2 text-muted-foreground">
            <SparkleIcon aria-hidden weight="fill" className="size-4 text-primary" />
            {search.data.reply}
            <span className="caption-1 text-foreground">{search.data.results.length} sonuç</span>
          </p>
          {search.data.results.length === 0 ? (
            <p className="body-6 rounded-2xl border border-dashed bg-surface p-6 text-center text-muted-foreground">
              Bu ölçütlere uyan istasyon bulunamadı. Daha az filtreyle veya yalnızca il adıyla yeniden deneyin.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {search.data.results.slice(0, 9).map((s) => (
                <StationCard key={s.uid} s={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
