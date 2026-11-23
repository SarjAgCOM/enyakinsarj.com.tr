"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon, SearchIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StationCard } from "./station-card";

const EXAMPLES = [
  "Bana en yakın 150 kW üstü DC şarj",
  "Kadıköy'de ZES istasyonları",
  "Ankara'da en ucuz DC şarj",
  "İzmir Bornova CHAdeMO",
];

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
  const search = useMutation(
    trpc.ai.search.mutationOptions({
      onError: (e) => toast.error(e.message),
    }),
  );

  async function run(q: string) {
    const text = q.trim();
    if (text.length < 3) return;
    setQuery(text);
    const wantsLocation = /yakın|yakın|yanımda|civar|etraf|konum/i.test(text);
    const location = wantsLocation ? await getLocation() : undefined;
    const res = await search.mutateAsync({ query: text, location }).catch(() => null);
    if (res?.needsLocation && !location) {
      const loc = await getLocation();
      if (loc) search.mutate({ query: text, location: loc });
      else toast.info("Konum izni verilmedi; il veya ilçe belirterek arayabilirsiniz.");
    }
  }

  return (
    <div className="w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        className="flex w-full items-center gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40"
      >
        <SparklesIcon className="ml-2 size-5 shrink-0 text-primary" aria-hidden />
        <label htmlFor="ai-search" className="sr-only">
          Şarj istasyonu ara
        </label>
        <Input
          id="ai-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ör. Bana en yakın 150 kW üstü Trugo istasyonu"
          className="h-11 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          maxLength={300}
          autoComplete="off"
        />
        <Button type="submit" size="lg" className="h-11 px-4" disabled={search.isPending}>
          {search.isPending ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
          <span className="hidden sm:inline">Ara</span>
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => void run(ex)}
            className="rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>

      {search.data && (
        <div className="mt-6 space-y-3 text-left" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <SparklesIcon className="size-4 text-primary" />
            {search.data.reply} — <span className="font-medium text-foreground">{search.data.results.length} sonuç</span>
          </p>
          {search.data.results.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Bu kriterlere uyan istasyon bulunamadı. Filtreleri gevşeterek tekrar deneyin.
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
