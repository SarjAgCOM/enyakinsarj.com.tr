import "server-only";
import type { SocialPlatform } from "@/generated/prisma/client";
import { db } from "../db";
import { decryptJson, encryptJson } from "../crypto";
import { absoluteUrl } from "@/lib/site";
import { fitTweet, postToX, verifyX, xCredentialsSchema } from "./x";
import { instagramCredentialsSchema, postCarouselToInstagram, postToInstagram, verifyInstagram } from "./instagram";

export const PLATFORMS: SocialPlatform[] = ["X", "INSTAGRAM"];

export const DEFAULT_TEMPLATES: Record<SocialPlatform, string> = {
  X: "⚡ {title}\n\n{url}\n\n{tags}",
  INSTAGRAM: "⚡ {title}\n\n{excerpt}\n\nYazının tamamı için bio'daki bağlantıya göz atın 🔗\n\n{tags}",
};

export const credentialSchemas = { X: xCredentialsSchema, INSTAGRAM: instagramCredentialsSchema } as const;

export async function saveCredentials(platform: SocialPlatform, raw: unknown) {
  const creds = credentialSchemas[platform].parse(raw);
  const accountName =
    platform === "X"
      ? await verifyX(creds as never).catch(() => null)
      : await verifyInstagram(creds as never).catch(() => null);
  await db.socialAccount.upsert({
    where: { platform },
    create: { platform, credentials: encryptJson(creds), accountName },
    update: { credentials: encryptJson(creds), accountName },
  });
  return { accountName, verified: accountName !== null };
}

interface ShareablePost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  tags: string[];
  coverImageUrl: string | null;
  socialX: string | null;
  socialInstagram: string | null;
}

const hashtag = (t: string) =>
  "#" +
  t
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 40);

export function renderMessage(platform: SocialPlatform, post: ShareablePost, template?: string | null) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  const custom = platform === "X" ? post.socialX : post.socialInstagram;
  const base = custom?.trim() || template?.trim() || DEFAULT_TEMPLATES[platform];
  let text = base
    .replaceAll("{title}", post.title)
    .replaceAll("{excerpt}", post.excerpt ?? "")
    .replaceAll("{url}", url)
    .replaceAll("{tags}", post.tags.slice(0, platform === "X" ? 2 : 12).map(hashtag).join(" "))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (platform === "X") {
    if (!text.includes(url)) text = `${text}\n\n${url}`;
    text = fitTweet(text);
  }
  return text;
}

/** Yazıyı seçili (yoksa etkin ve otomatik paylaşımı açık) platformlarda paylaşır; her denemeyi kaydeder. */
export async function sharePost(postId: string, opts: { platforms?: SocialPlatform[]; auto?: boolean } = {}) {
  const post = await db.post.findUniqueOrThrow({ where: { id: postId } });
  if (post.status !== "PUBLISHED") throw new Error("Yalnızca yayınlanmış yazılar paylaşılabilir.");

  const accounts = await db.socialAccount.findMany({
    where: {
      enabled: true,
      ...(opts.platforms?.length ? { platform: { in: opts.platforms } } : {}),
      ...(opts.auto ? { autoShareOnPublish: true } : {}),
    },
  });

  const results: { platform: SocialPlatform; ok: boolean; url?: string | null; error?: string }[] = [];
  for (const account of accounts) {
    const message = renderMessage(account.platform, post, account.template);
    const log = await db.socialPost.create({ data: { postId, platform: account.platform, message } });
    try {
      let out: { externalId: string; url: string | null };
      if (account.platform === "X") {
        const creds = xCredentialsSchema.parse(decryptJson(account.credentials));
        out = await postToX(creds, message);
      } else {
        const creds = instagramCredentialsSchema.parse(decryptJson(account.credentials));
        // Instagram görseli kendi sunucusundan indirir; adres tam (alan adlı) olmalı.
        if (post.coverImageUrl) {
          out = await postToInstagram(creds, { imageUrl: absoluteUrl(post.coverImageUrl), caption: message });
        } else {
          // Kapak yüklenmemişse sitenin ürettiği kare görseller kullanılır: kapak + öne çıkan maddelerin kartları.
          const base = absoluteUrl(`/kapak/${post.slug}.jpg?b=kare`);
          const imageUrls = [base, ...post.highlights.slice(0, 4).map((_, i) => `${base}&n=${i + 1}`)];
          out = await postCarouselToInstagram(creds, { imageUrls, caption: message }).catch((e: Error) => {
            // Dizi oluşturulamazsa tek görselle paylaşım denenir.
            if (imageUrls.length < 2) throw e;
            return postToInstagram(creds, { imageUrl: base, caption: message });
          });
        }
      }
      await db.socialPost.update({
        where: { id: log.id },
        data: { status: "SUCCESS", externalId: out.externalId, url: out.url },
      });
      results.push({ platform: account.platform, ok: true, url: out.url });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await db.socialPost.update({ where: { id: log.id }, data: { status: "FAILED", error } });
      results.push({ platform: account.platform, ok: false, error });
    }
  }
  if (results.some((r) => r.ok)) await db.post.update({ where: { id: postId }, data: { sharedAt: new Date() } });
  return results;
}
