import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { adminProcedure, createTRPCRouter, editorProcedure } from "../trpc";
import { slugify } from "@/lib/slug";
import { fmtInt, fmtTl } from "@/lib/format";
import { db } from "../../db";
import { publishPost, revalidatePosts } from "../../services/posts";
import { getCityTable, getPriceTable, getStats, listProviders } from "../../services/stations";
import { runSync } from "../../services/sync";
import { CACHE_TAGS } from "../../services/cache-tags";
import { sarjag } from "../../sarjag/client";
import {
  AI_PROVIDERS,
  AI_PROVIDER_INFO,
  AiError,
  aiConfig,
  clearPanelAiSettings,
  generateBlogPost,
  generateProviderContent,
  generateSeoMeta,
  generateSocialCopy,
  getPanelAiSettings,
  savePanelAiSettings,
  testAiConnection,
} from "../../ai";
import { DEFAULT_TEMPLATES, PLATFORMS, renderMessage, saveCredentials, sharePost } from "../../social";
import { deleteObject, isStorageConfigured } from "../../storage";

const platformSchema = z.enum(["X", "INSTAGRAM"]);
const nullableText = (max: number) => z.string().max(max).nullish().transform((v) => (v?.trim() ? v.trim() : null));

const postFields = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().max(200).optional(),
  excerpt: nullableText(500),
  content: z.string().min(1),
  coverImageUrl: nullableText(1000),
  coverImageAlt: nullableText(300),
  seoTitle: nullableText(120),
  seoDescription: nullableText(320),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  categoryId: z.string().nullish(),
  autoShare: z.boolean().default(true),
  socialX: nullableText(1000),
  socialInstagram: nullableText(2200),
  aiGenerated: z.boolean().optional(),
});

async function uniquePostSlug(base: string, excludeId?: string) {
  const root = slugify(base, 90) || "yazi";
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = await db.post.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
}

async function buildDataContext() {
  const [stats, prices, cities, providers] = await Promise.all([getStats(), getPriceTable(), getCityTable(), listProviders()]);
  return [
    `- Toplam halka açık istasyon: ${fmtInt(stats.stations)} (DC hızlı: ${fmtInt(stats.dc)}, 150 kW+: ${fmtInt(stats.ultra)})`,
    `- Şarj ağı sayısı: ${stats.providers}, istasyon bulunan il: ${stats.cities}, toplam soket: ${fmtInt(stats.connectors)}`,
    `- En büyük ağlar: ${providers.slice(0, 8).map((p) => `${p.name} (${fmtInt(p.stationCount)})`).join(", ")}`,
    `- En çok istasyonlu iller: ${cities.slice(0, 8).map((c) => `${c.name} (${fmtInt(c.count)})`).join(", ")}`,
    `- En düşük kWh fiyatları (KDV dahil, istasyona göre değişebilir): ${prices
      .slice(0, 8)
      .map((p) => `${p.name} AC ${fmtTl(p.minAcPrice)} / DC ${fmtTl(p.minDcPrice)}`)
      .join("; ")}`,
  ].join("\n");
}

// ─────────────────────────── Yazılar ───────────────────────────

const postRouter = createTRPCRouter({
  list: editorProcedure
    .input(
      z.object({
        status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]).optional(),
        q: z.string().max(100).optional(),
        page: z.number().int().min(1).default(1),
      }),
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.q ? { title: { contains: input.q, mode: "insensitive" as const } } : {}),
      };
      const take = 20;
      const [items, total] = await Promise.all([
        db.post.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (input.page - 1) * take,
          take,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            publishedAt: true,
            updatedAt: true,
            viewCount: true,
            sharedAt: true,
            aiGenerated: true,
            category: { select: { name: true } },
            _count: { select: { socialPosts: true } },
          },
        }),
        db.post.count({ where }),
      ]);
      return { items, total, pages: Math.max(1, Math.ceil(total / take)) };
    }),

  byId: editorProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const post = await db.post.findUnique({
      where: { id: input.id },
      include: { socialPosts: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Yazı bulunamadı" });
    return post;
  }),

  create: editorProcedure.input(postFields).mutation(async ({ input, ctx }) => {
    const slug = await uniquePostSlug(input.slug || input.title);
    const post = await db.post.create({ data: { ...input, slug, authorId: ctx.user.id } });
    return post;
  }),

  update: editorProcedure.input(postFields.partial().extend({ id: z.string() })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    if (data.slug !== undefined || data.title !== undefined) {
      const current = await db.post.findUniqueOrThrow({ where: { id }, select: { slug: true, status: true } });
      // Yayınlanmış yazının slug'ı yalnızca açıkça değiştirilirse güncellenir (SEO bağlantılarını korumak için).
      data.slug = data.slug ? await uniquePostSlug(data.slug, id) : current.slug;
    }
    const post = await db.post.update({ where: { id }, data });
    revalidatePosts();
    return post;
  }),

  delete: editorProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.post.delete({ where: { id: input.id } });
    revalidatePosts();
    return { ok: true };
  }),

  publish: editorProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => publishPost(input.id)),

  unpublish: editorProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const post = await db.post.update({ where: { id: input.id }, data: { status: "DRAFT" } });
    revalidatePosts();
    return post;
  }),

  schedule: editorProcedure
    .input(z.object({ id: z.string(), publishAt: z.date() }))
    .mutation(async ({ input }) => {
      if (input.publishAt.getTime() < Date.now() - 60_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Planlanan tarih gelecekte olmalı." });
      }
      return db.post.update({ where: { id: input.id }, data: { status: "SCHEDULED", publishedAt: input.publishAt } });
    }),

  share: editorProcedure
    .input(z.object({ id: z.string(), platforms: z.array(platformSchema).min(1) }))
    .mutation(({ input }) => sharePost(input.id, { platforms: input.platforms })),

  sharePreview: editorProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const post = await db.post.findUniqueOrThrow({ where: { id: input.id } });
    const accounts = await db.socialAccount.findMany();
    return PLATFORMS.map((platform) => ({
      platform,
      enabled: accounts.find((a) => a.platform === platform)?.enabled ?? false,
      message: renderMessage(platform, post, accounts.find((a) => a.platform === platform)?.template),
    }));
  }),
});

// ─────────────────────────── Kategoriler ───────────────────────────

const categoryRouter = createTRPCRouter({
  list: editorProcedure.query(() =>
    db.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } }),
  ),
  upsert: editorProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(2).max(80),
        slug: z.string().max(80).optional(),
        description: nullableText(500),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = slugify(input.slug || input.name);
      const data = { name: input.name, slug, description: input.description };
      const res = input.id
        ? await db.category.update({ where: { id: input.id }, data })
        : await db.category.create({ data });
      revalidatePosts();
      return res;
    }),
  delete: editorProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.category.delete({ where: { id: input.id } });
    revalidatePosts();
    return { ok: true };
  }),
});

// ─────────────────────────── Medya ───────────────────────────

const mediaRouter = createTRPCRouter({
  list: editorProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), q: z.string().max(100).optional() }))
    .query(async ({ input }) => {
      const take = 30;
      const where = input.q ? { fileName: { contains: input.q, mode: "insensitive" as const } } : {};
      const [items, total] = await Promise.all([
        db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * take, take }),
        db.media.count({ where }),
      ]);
      return { items, total, pages: Math.max(1, Math.ceil(total / take)), storageReady: isStorageConfigured() };
    }),
  updateAlt: editorProcedure
    .input(z.object({ id: z.string(), alt: nullableText(300) }))
    .mutation(({ input }) => db.media.update({ where: { id: input.id }, data: { alt: input.alt } })),
  delete: editorProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const m = await db.media.findUniqueOrThrow({ where: { id: input.id } });
    await deleteObject(m.key);
    await db.media.delete({ where: { id: m.id } });
    return { ok: true };
  }),
});

// ─────────────────────────── Yapay zekâ ───────────────────────────

const aiAdminRouter = createTRPCRouter({
  status: editorProcedure.query(async () => {
    const cfg = await aiConfig();
    // limited: anahtarsız ücretsiz katman; yalnızca kısa metinler (SEO, sosyal) üretilebilir, çağrılar sıraya alınır.
    return { configured: cfg !== null, label: cfg?.label ?? null, limited: cfg?.provider === "free" };
  }),

  /** Sağlayıcı ayarı (yalnızca yönetici). Anahtarın kendisi hiçbir zaman istemciye gönderilmez. */
  settings: adminProcedure.query(async () => {
    const [panel, cfg] = await Promise.all([getPanelAiSettings(), aiConfig()]);
    return {
      // "panel": bu ekrandan kaydedildi; "env": ortam değişkenleri kullanılıyor
      source: panel ? ("panel" as const) : ("env" as const),
      provider: panel?.provider ?? null,
      hasKey: Boolean(panel?.apiKey),
      // Hangi anahtarın kayıtlı olduğunu ayırt etmek için yalnızca son 4 karakter
      keyHint: panel?.apiKey ? panel.apiKey.slice(-4) : null,
      model: panel?.model ?? null,
      baseUrl: panel?.baseUrl ?? null,
      effective: cfg ? { provider: cfg.provider, label: cfg.label, model: cfg.model, limited: cfg.provider === "free" } : null,
      providers: AI_PROVIDER_INFO,
    };
  }),

  saveSettings: adminProcedure
    .input(
      z.object({
        provider: z.enum(AI_PROVIDERS),
        // Boş bırakılırsa aynı sağlayıcı için kayıtlı anahtar korunur
        apiKey: z.string().trim().max(500).optional(),
        model: z.string().trim().max(200).optional(),
        baseUrl: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const info = AI_PROVIDER_INFO.find((p) => p.id === input.provider)!;
      const current = await getPanelAiSettings();
      const apiKey = info.needsKey ? input.apiKey || (current?.provider === input.provider ? current.apiKey : null) : null;
      if (info.needsKey && !apiKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${info.label} için API anahtarı girin.` });
      }
      let baseUrl: string | null = null;
      if (input.provider === "custom") {
        let url: URL | null = null;
        try {
          url = new URL(input.baseUrl ?? "");
        } catch {
          url = null;
        }
        const insecureOk = process.env.NODE_ENV !== "production";
        if (!url || !(url.protocol === "https:" || (insecureOk && url.protocol === "http:"))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Özel servis için https ile başlayan geçerli bir adres girin." });
        }
        if (!input.model) throw new TRPCError({ code: "BAD_REQUEST", message: "Özel servis için model adı girin." });
        baseUrl = url.toString().replace(/\/+$/, "");
      }
      await savePanelAiSettings({ provider: input.provider, apiKey, model: input.model || null, baseUrl });
      const cfg = await aiConfig();
      return { label: cfg?.label ?? null, model: cfg?.model ?? null };
    }),

  /** Panel ayarını siler; ortam değişkenlerine (yoksa anahtarsız servise) dönülür. */
  resetSettings: adminProcedure.mutation(async () => {
    await clearPanelAiSettings();
    return { ok: true };
  }),

  /** Etkin sağlayıcıya küçük bir istek gönderip anahtarı ve modeli sınar. */
  test: adminProcedure.mutation(async () => {
    try {
      return { ok: true as const, ...(await testAiConnection()) };
    } catch (e) {
      if (e instanceof AiError) return { ok: false as const, message: e.message };
      throw e;
    }
  }),

  generatePost: editorProcedure
    .input(
      z.object({
        topic: z.string().trim().min(5).max(500),
        keywords: z.array(z.string().max(60)).max(15).default([]),
        tone: z.enum(["bilgilendirici", "samimi", "teknik", "haber"]).default("bilgilendirici"),
        length: z.enum(["kisa", "orta", "uzun"]).default("orta"),
        instructions: z.string().max(2000).optional(),
        categoryId: z.string().nullish(),
        useSiteData: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const category = input.categoryId ? await db.category.findUnique({ where: { id: input.categoryId } }) : null;
      const dataContext = input.useSiteData ? await buildDataContext() : undefined;
      const out = await generateBlogPost({ ...input, categoryName: category?.name, dataContext });
      return { ...out, slug: slugify(out.slug || out.title, 90) };
    }),

  seoMeta: editorProcedure
    .input(z.object({ title: z.string().min(3), content: z.string().min(50) }))
    .mutation(({ input }) => generateSeoMeta(input)),

  socialCopy: editorProcedure
    .input(z.object({ title: z.string().min(3), excerpt: z.string().nullish(), content: z.string().min(50) }))
    .mutation(({ input }) => generateSocialCopy(input)),

  providerContent: editorProcedure.input(z.object({ providerId: z.string() })).mutation(async ({ input }) => {
    const p = await db.provider.findUniqueOrThrow({ where: { id: input.providerId } });
    const cities = await db.station.groupBy({
      by: ["city"],
      where: { providerId: p.id, isActive: true, city: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } },
      take: 10,
    });
    const stats = [
      `İstasyon: ${fmtInt(p.stationCount)}, DC istasyon: ${fmtInt(p.dcStationCount)}, soket: ${fmtInt(p.connectorCount)}`,
      `En yüksek güç: ${p.maxPowerKw ?? "-"} kW`,
      `AC kWh: ${fmtTl(p.minAcPrice)} – ${fmtTl(p.maxAcPrice)}, DC kWh: ${fmtTl(p.minDcPrice)} – ${fmtTl(p.maxDcPrice)}`,
      `En çok istasyon olan iller: ${cities.map((c) => `${c.city} (${c._count._all})`).join(", ")}`,
    ].join("\n");
    return { content: await generateProviderContent({ name: p.name, website: p.website, stats }) };
  }),
});

// ─────────────────────────── Sosyal medya ───────────────────────────

const socialRouter = createTRPCRouter({
  accounts: editorProcedure.query(async () => {
    const accounts = await db.socialAccount.findMany();
    return PLATFORMS.map((platform) => {
      const a = accounts.find((x) => x.platform === platform);
      return {
        platform,
        enabled: a?.enabled ?? false,
        accountName: a?.accountName ?? null,
        hasCredentials: Boolean(a?.credentials),
        template: a?.template ?? DEFAULT_TEMPLATES[platform],
        autoShareOnPublish: a?.autoShareOnPublish ?? true,
        updatedAt: a?.updatedAt ?? null,
      };
    });
  }),
  saveCredentials: adminProcedure
    .input(
      z.discriminatedUnion("platform", [
        z.object({
          platform: z.literal("X"),
          credentials: z.object({
            apiKey: z.string().trim().min(1),
            apiSecret: z.string().trim().min(1),
            accessToken: z.string().trim().min(1),
            accessTokenSecret: z.string().trim().min(1),
          }),
        }),
        z.object({
          platform: z.literal("INSTAGRAM"),
          credentials: z.object({ igUserId: z.string().trim().min(1), accessToken: z.string().trim().min(1) }),
        }),
      ]),
    )
    .mutation(({ input }) => saveCredentials(input.platform, input.credentials)),
  update: adminProcedure
    .input(
      z.object({
        platform: platformSchema,
        enabled: z.boolean().optional(),
        template: nullableText(2200).optional(),
        autoShareOnPublish: z.boolean().optional(),
      }),
    )
    .mutation(({ input }) => {
      const { platform, ...data } = input;
      return db.socialAccount.upsert({ where: { platform }, create: { platform, ...data }, update: data });
    }),
  logs: editorProcedure.input(z.object({ page: z.number().int().min(1).default(1) })).query(async ({ input }) => {
    const take = 25;
    const [items, total] = await Promise.all([
      db.socialPost.findMany({
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * take,
        take,
        include: { post: { select: { title: true, slug: true, id: true } } },
      }),
      db.socialPost.count(),
    ]);
    return { items, total, pages: Math.max(1, Math.ceil(total / take)) };
  }),
});

// ─────────────────────────── Şarjağ senkronu & ağlar ───────────────────────────

const syncRouter = createTRPCRouter({
  runs: editorProcedure.query(() => db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 })),
  trigger: adminProcedure
    .input(z.object({ providerIds: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => {
      // Uzun sürebileceği için arka planda başlatılır; ilerleme "runs" listesinden izlenir.
      void runSync({ trigger: "manual", providerIds: input.providerIds }).catch((e) => console.error("sync failed", e));
      return { started: true };
    }),
  sarjagMe: editorProcedure.query(async () => {
    try {
      const { data } = await sarjag.me();
      return { ok: true as const, ...data };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }),
});

const providerAdminRouter = createTRPCRouter({
  list: editorProcedure.query(() => db.provider.findMany({ orderBy: [{ stationCount: "desc" }, { name: "asc" }] })),
  update: editorProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(100).optional(),
        website: nullableText(300).optional(),
        logoUrl: nullableText(1000).optional(),
        description: nullableText(2000).optional(),
        seoContent: nullableText(30000).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const p = await db.provider.update({ where: { id }, data });
      revalidateTag(CACHE_TAGS.stations, { expire: 0 });
      return p;
    }),
});

// ─────────────────────────── Kullanıcılar ───────────────────────────

const userRouter = createTRPCRouter({
  list: adminProcedure.query(() =>
    db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, role: true, createdAt: true } }),
  ),
  create: adminProcedure
    .input(
      z.object({
        email: z.email(),
        name: z.string().trim().min(2).max(80),
        password: z.string().min(10).max(200),
        role: z.enum(["ADMIN", "EDITOR"]),
      }),
    )
    .mutation(async ({ input }) => {
      const exists = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Bu e-posta zaten kayıtlı." });
      const user = await db.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          role: input.role,
          passwordHash: await bcrypt.hash(input.password, 12),
        },
      });
      return { id: user.id };
    }),
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Kendi hesabınızı silemezsiniz." });
    await db.user.delete({ where: { id: input.id } });
    return { ok: true };
  }),
  changePassword: editorProcedure
    .input(z.object({ current: z.string().min(1), next: z.string().min(10).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
      if (!(await bcrypt.compare(input.current, user.passwordHash))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mevcut şifre hatalı." });
      }
      await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.next, 12) } });
      return { ok: true };
    }),
});

// ─────────────────────────── Pano ───────────────────────────

const dashboardRouter = createTRPCRouter({
  overview: editorProcedure.query(async () => {
    const [stats, posts, drafts, scheduled, lastRun, recentShares, topPosts, ai] = await Promise.all([
      getStats(),
      db.post.count({ where: { status: "PUBLISHED" } }),
      db.post.count({ where: { status: "DRAFT" } }),
      db.post.count({ where: { status: "SCHEDULED" } }),
      db.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
      db.socialPost.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { post: { select: { title: true } } } }),
      db.post.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { viewCount: "desc" },
        take: 5,
        select: { id: true, title: true, viewCount: true, slug: true },
      }),
      aiConfig(),
    ]);
    return {
      stats,
      posts: { published: posts, drafts, scheduled },
      lastRun,
      recentShares,
      topPosts,
      ai: ai !== null,
      // Etkin sağlayıcı ve model (anahtar gösterilmez)
      aiLabel: ai ? `${ai.label} · ${ai.model}` : null,
      storage: isStorageConfigured(),
    };
  }),
});

export const adminRouter = createTRPCRouter({
  dashboard: dashboardRouter,
  post: postRouter,
  category: categoryRouter,
  media: mediaRouter,
  ai: aiAdminRouter,
  social: socialRouter,
  sync: syncRouter,
  provider: providerAdminRouter,
  user: userRouter,
});
