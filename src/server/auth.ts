import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { db } from "./db";

export const SESSION_COOKIE = "eys_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 gün

export interface SessionPayload {
  sub: string;
  role: "ADMIN" | "EDITOR";
}

const secretKey = () => new TextEncoder().encode(`session:${env().APP_SECRET}`);

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role === "ADMIN" ? "ADMIN" : "EDITOR" };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Geçerli oturumdaki kullanıcı (istek başına bir kez sorgulanır). */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true },
  });
});
