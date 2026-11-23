import "server-only";
import type { z } from "zod";
import { env } from "../env";
import {
  meResponseSchema,
  providersResponseSchema,
  stationResponseSchema,
  stationsResponseSchema,
  statusResponseSchema,
} from "./schemas";

/**
 * Şarjağ API istemcisi — YALNIZCA sunucuda çalışır. API anahtarı tarayıcıya gönderilmez.
 * Docs: https://console.sarjag.com/dashboard/docs
 */

export class SarjagError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "SarjagError";
  }
}

export interface SarjagUsage {
  cost: number | null;
  balance: number | null;
  remaining: number | null;
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  query?: Record<string, string | undefined>,
): Promise<{ data: z.infer<S>; usage: SarjagUsage }> {
  const { SARJAG_API_KEY, SARJAG_API_URL } = env();
  if (!SARJAG_API_KEY) throw new SarjagError(500, "MISSING_API_KEY", "SARJAG_API_KEY tanımlı değil.");

  const url = new URL(SARJAG_API_URL.replace(/\/+$/, "") + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${SARJAG_API_KEY}`, "Accept-Language": "tr", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new SarjagError(0, "NETWORK_ERROR", `Şarjağ API'ye ulaşılamadı: ${(e as Error).message}`);
  }

  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!res.ok || !body) {
    throw new SarjagError(res.status, body?.error?.code ?? `HTTP_${res.status}`, body?.error?.message ?? res.statusText);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new SarjagError(502, "INVALID_RESPONSE", `Beklenmeyen API yanıtı (${path}): ${parsed.error.issues[0]?.message}`);
  }

  const num = (h: string) => (res.headers.has(h) ? Number(res.headers.get(h)) : null);
  return {
    data: parsed.data,
    usage: { cost: num("x-token-cost"), balance: num("x-token-balance"), remaining: num("x-ratelimit-remaining") },
  };
}

const enc = encodeURIComponent;

export const sarjag = {
  /** GET /me — proje, bakiye (ücretsiz) */
  me: () => request("/me", meResponseSchema),
  /** GET /providers — desteklenen şarj ağları (ücretsiz) */
  providers: () => request("/providers", providersResponseSchema),
  /** GET /providers/:provider/stations — ağın tüm istasyonları (token) */
  stations: (provider: string, filter: { city?: string; powerType?: "AC" | "DC" } = {}) =>
    request(`/providers/${enc(provider)}/stations`, stationsResponseSchema, filter),
  /** GET /providers/:provider/stations/:stationId — tek istasyon (token) */
  station: (provider: string, stationId: string) =>
    request(`/providers/${enc(provider)}/stations/${enc(stationId)}`, stationResponseSchema),
  /** GET /providers/:provider/status?ids=… — anlık soket durumu (istasyon başına token, en fazla 50) */
  status: (provider: string, stationIds: string[]) =>
    request(`/providers/${enc(provider)}/status`, statusResponseSchema, { ids: stationIds.slice(0, 50).join(",") }),
};
