"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import { clearSessionCookie, setSessionCookie } from "@/server/auth";

const attempts = new Map<string, number[]>();

const loginSchema = z.object({
  email: z.email("Geçerli bir e-posta girin"),
  password: z.string().min(1, "Şifre gerekli"),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
  if (recent.length >= 10) return { error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." };

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  const ok = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    attempts.set(ip, [...recent, now]);
    return { error: "E-posta veya şifre hatalı." };
  }
  attempts.delete(ip);
  await setSessionCookie({ sub: user.id, role: user.role });

  const next = parsed.data.next;
  redirect(next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/admin/giris");
}
