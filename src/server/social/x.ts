import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";

/** X (Twitter) API v2 — OAuth 1.0a kullanıcı bağlamıyla gönderi paylaşımı. */

export const xCredentialsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  accessToken: z.string().min(1),
  accessTokenSecret: z.string().min(1),
});
export type XCredentials = z.infer<typeof xCredentialsSchema>;

const rfc3986 = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function oauthHeader(method: string, url: string, creds: XCredentials) {
  const params: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  // JSON gövdeli isteklerde gövde imzaya dahil edilmez.
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join("&");
  const base = [method.toUpperCase(), rfc3986(url), rfc3986(paramString)].join("&");
  const key = `${rfc3986(creds.apiSecret)}&${rfc3986(creds.accessTokenSecret)}`;
  params.oauth_signature = createHmac("sha1", key).update(base).digest("base64");
  return (
    "OAuth " +
    Object.keys(params)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(params[k])}"`)
      .join(", ")
  );
}

export async function postToX(creds: XCredentials, text: string) {
  const url = "https://api.x.com/2/tweets";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: oauthHeader("POST", url, creds), "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => null)) as { data?: { id: string }; detail?: string; title?: string } | null;
  if (!res.ok || !body?.data?.id) {
    throw new Error(`X API ${res.status}: ${body?.detail ?? body?.title ?? res.statusText}`);
  }
  return { externalId: body.data.id, url: `https://x.com/i/web/status/${body.data.id}` };
}

export async function verifyX(creds: XCredentials) {
  const url = "https://api.x.com/2/users/me";
  const res = await fetch(url, { headers: { Authorization: oauthHeader("GET", url, creds) }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json().catch(() => null)) as { data?: { username: string }; detail?: string } | null;
  if (!res.ok || !body?.data) throw new Error(`X API ${res.status}: ${body?.detail ?? res.statusText}`);
  return `@${body.data.username}`;
}

/** X, bağlantıları 23 karakter sayar; metni 280 sınırına göre kısaltır. */
export function fitTweet(text: string) {
  const urlRe = /https?:\/\/\S+/g;
  const weighted = (t: string) => t.replace(urlRe, "x".repeat(23)).length;
  if (weighted(text) <= 280) return text;
  const urls = text.match(urlRe) ?? [];
  let plain = text.replace(urlRe, "").trim();
  const suffix = urls.length ? ` ${urls.join(" ")}` : "";
  while (weighted(plain + "…" + suffix) > 280 && plain.length > 0) plain = plain.slice(0, -1);
  return `${plain.trimEnd()}…${suffix}`;
}
