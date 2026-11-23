"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/ssr";
import { useTRPC } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, fmtDateTime, fmtKw } from "@/lib/format";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  AVAILABLE: "bg-success/10 text-success",
  OCCUPIED: "bg-warning/15 text-warning",
  RESERVED: "bg-warning/15 text-warning",
  OUT_OF_ORDER: "bg-destructive/10 text-destructive",
};

/** Şarjağ üzerinden anlık soket doluluğu. Kullanıcı istediğinde çekilir (token tasarrufu). */
export function LiveStatus({ uid }: { uid: string }) {
  const trpc = useTRPC();
  const q = useQuery({ ...trpc.station.liveStatus.queryOptions({ uid }), enabled: false, retry: false });

  if (!q.data && !q.isFetching && !q.isError) {
    return (
      <Button onClick={() => q.refetch()} variant="outline">
        <ArrowsClockwiseIcon data-icon="inline-start" />
        Anlık doluluğu göster
      </Button>
    );
  }

  if (q.isFetching && !q.data) {
    return (
      <div className="flex flex-col gap-3" aria-label="Anlık durum alınıyor" aria-busy>
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (q.isError || (q.data && !q.data.ok)) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="body-6 text-destructive">
          {q.data && !q.data.ok ? q.data.message : "Anlık durum alınamadı. Bağlantınızı kontrol edip yeniden deneyin."}
        </p>
        <Button variant="outline" size="sm" onClick={() => q.refetch()}>
          <ArrowsClockwiseIcon data-icon="inline-start" /> Yeniden dene
        </Button>
      </div>
    );
  }

  const d = q.data;
  if (!d || !d.ok) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="heading-6 tabular-nums">
          {d.available} / {d.total} soket müsait
        </p>
        <Button variant="ghost" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <ArrowsClockwiseIcon data-icon="inline-start" /> {q.isFetching ? "Yenileniyor" : "Yenile"}
        </Button>
        <span className="caption-5 text-muted-foreground">Son kontrol {fmtDateTime(d.fetchedAt)}</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {d.connectors.map((c) => (
          <li key={c.uid} className="surface-card flex items-center justify-between gap-2 px-3 py-2">
            <span className="caption-5 font-mono text-muted-foreground">
              {c.evseId ?? c.uid.split(":").pop()} · {c.powerType ?? ""} {fmtKw(c.maxPowerKw)}
            </span>
            <Badge className={cn("border-0", tone[c.status] ?? "bg-muted text-muted-foreground")}>
              {STATUS_LABELS[c.status] ?? c.status}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
