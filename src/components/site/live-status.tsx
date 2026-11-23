"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useTRPC } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, fmtDateTime, fmtKw } from "@/lib/format";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  AVAILABLE: "bg-green-600/10 text-green-700 dark:text-green-400",
  OCCUPIED: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  RESERVED: "bg-amber-500/15 text-amber-700",
  OUT_OF_ORDER: "bg-red-600/10 text-red-700 dark:text-red-400",
};

/** Şarjağ üzerinden anlık soket doluluğu — kullanıcı istediğinde çekilir (token tasarrufu). */
export function LiveStatus({ uid }: { uid: string }) {
  const trpc = useTRPC();
  const q = useQuery({ ...trpc.station.liveStatus.queryOptions({ uid }), enabled: false, retry: false });

  if (!q.data && !q.isFetching) {
    return (
      <Button onClick={() => q.refetch()} variant="outline" size="lg">
        <RefreshCwIcon data-icon="inline-start" />
        Anlık doluluk durumunu getir
      </Button>
    );
  }
  if (q.isFetching && !q.data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Anlık durum alınıyor…
      </p>
    );
  }
  const d = q.data!;
  if (!d.ok) return <p className="text-sm text-destructive">{d.message}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-lg font-semibold">
          {d.available} / {d.total} soket müsait
        </p>
        <Button variant="ghost" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCwIcon className={cn(q.isFetching && "animate-spin")} data-icon="inline-start" /> Yenile
        </Button>
        <span className="text-xs text-muted-foreground">Son kontrol: {fmtDateTime(d.fetchedAt)}</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {d.connectors.map((c) => (
          <li key={c.uid} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground">
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
