import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { AiError } from "../ai";

export async function createTRPCContext(opts: { headers: Headers }) {
  const user = await getCurrentUser();
  const ip =
    opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? opts.headers.get("x-real-ip") ?? "unknown";
  return { db, user, ip, headers: opts.headers };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/** Bilinen servis hatalarını kullanıcıya gösterilebilir tRPC hatalarına çevirir. */
const errorMapper = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof AiError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: result.error.cause.message, cause: result.error.cause });
  }
  return result;
});

export const publicProcedure = t.procedure.use(errorMapper);

export const editorProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Oturum açmanız gerekiyor." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = editorProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN") throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem için yönetici yetkisi gerekli." });
  return next();
});

// ── Basit bellek içi hız sınırlayıcı (tek sunucu kurulumu için yeterli) ──
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Çok fazla istek gönderdiniz, lütfen biraz bekleyin." });
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear();
}
