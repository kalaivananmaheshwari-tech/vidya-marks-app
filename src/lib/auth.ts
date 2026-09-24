import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { schools, sessions, users, type School, type User } from "@/db/schema";

export const SESSION_COOKIE = "sms_session";
const SESSION_DAYS = 7;

export const UDISE_LENGTH = 11;

export function isValidUdise(code: string): boolean {
  return new RegExp(`^\\d{${UDISE_LENGTH}}$`).test(code);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export type SafeUser = Omit<User, "passwordHash">;
export type AuthContext = { user: SafeUser; school: School };

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _ignored, ...rest } = user;
  void _ignored;
  return rest;
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token)).catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
}

export const getAuth = cache(async (): Promise<AuthContext | null> => {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const rows = await db
      .select({ user: users, school: schools })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(schools, eq(schools.id, users.schoolId))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row || !row.user.isActive) return null;
    return { user: toSafeUser(row.user), school: row.school };
  } catch {
    return null;
  }
});

export async function getCurrentUser(): Promise<SafeUser | null> {
  const auth = await getAuth();
  return auth?.user ?? null;
}

/** School admin = Principal / Headmaster who registered the school. */
export function isAdmin(user: { role: string } | null | undefined): boolean {
  return user?.role === "admin";
}
