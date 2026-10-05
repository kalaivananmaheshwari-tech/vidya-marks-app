import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { and, eq, gt, or } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { schools, sessions, users, schoolMemberships, membershipRoles, geographicScopes, type School, type User } from "@/db/schema";
import { validGeographicScope, type GeographicScope } from "@/lib/domain/geography";

export const SESSION_COOKIE = "sms_session";
export const UDISE_LENGTH = 11;
export const isValidUdise = (code: string) => /^\d{11}$/.test(code);
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
    const candidate = scryptSync(password, salt, 64);
    return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
  } catch { return false; }
}
export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");
export type SafeUser = Omit<User, "passwordHash">;
export type AuthContext = {
  user: SafeUser; school: School | null; membershipId: string | null;
  roles: string[]; geographicScope: GeographicScope | null;
};
export type SchoolAuthContext = Omit<AuthContext, "user" | "school" | "membershipId"> & {
  user: SafeUser & { schoolId: number }; school: School; membershipId: string;
};
export function toSafeUser(user: User): SafeUser {
  const { passwordHash: ignored, ...rest } = user; void ignored; return rest;
}
export function isAdmin(user: { role: string } | null | undefined): boolean {
  return Boolean(user && ["admin", "ADMIN", "HEADMASTER", "PRINCIPAL"].includes(user.role));
}
export async function issueSession(userId: number, membershipId: string | null, executor: DbExecutor = db) {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await executor.insert(sessions).values({ token: hashSessionToken(rawToken), userId, membershipId, expiresAt });
  return { rawToken, expiresAt };
}
export async function setSessionCookie(session: { rawToken: string; expiresAt: Date }) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.rawToken, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", expires: session.expiresAt });
}
/** Compatibility helper; newly issued sessions always carry a stored membership. */
export async function createSession(userId: number): Promise<string> {
  const [membership] = await db.select().from(schoolMemberships).where(and(eq(schoolMemberships.userId, userId), eq(schoolMemberships.isActive, true))).limit(1);
  const session = await issueSession(userId, membership?.id ?? null);
  await setSessionCookie(session); return session.rawToken;
}
export async function destroySession(): Promise<void> {
  const jar = await cookies(); const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(or(eq(sessions.token, hashSessionToken(token)), eq(sessions.token, token)));
  jar.delete(SESSION_COOKIE);
}
/** Authorization derives from membership/session records, NOT users.school_id or request attributes. */
export async function authForToken(token: string, executor: DbExecutor = db): Promise<AuthContext | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await executor.select({ user: users, membership: schoolMemberships, school: schools })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(schoolMemberships, and(eq(schoolMemberships.id, sessions.membershipId), eq(schoolMemberships.userId, users.id)))
    .leftJoin(schools, eq(schools.id, schoolMemberships.schoolId))
    .where(and(or(eq(sessions.token, hashSessionToken(token)), eq(sessions.token, token)), gt(sessions.expiresAt, new Date()), eq(users.isActive, true))).limit(1);
  if (!row) return null;
  if (row.membership && row.school && row.membership.isActive) {
    const roleRows = await executor.select().from(membershipRoles).where(eq(membershipRoles.membershipId, row.membership.id));
    const roles = roleRows.map((r) => r.role);
    const admin = roles.some((r) => ["ADMIN", "HEADMASTER", "PRINCIPAL"].includes(r));
    if (!admin && !roles.includes("TEACHER")) return null;
    return { user: { ...toSafeUser(row.user), schoolId: row.school.id, role: admin ? "admin" : "teacher", userType: roles.find((r) => r !== "TEACHER") ?? "TEACHER" }, school: row.school, membershipId: row.membership.id, roles, geographicScope: null };
  }
  // A disabled/invalid school membership must never fall back to a geographic role.
  if (row.membership) return null;
  const [scope] = await executor.select().from(geographicScopes).where(eq(geographicScopes.userId, row.user.id)).limit(1);
  if (!scope || !validGeographicScope(scope) || row.user.schoolId !== null) return null;
  return { user: { ...toSafeUser(row.user), schoolId: null, role: scope.role, userType: scope.role }, school: null, membershipId: null, roles: [scope.role], geographicScope: scope };
}
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const jar = await cookies(); const token = jar.get(SESSION_COOKIE)?.value;
  return token ? authForToken(token) : null;
});
export async function getCurrentUser(): Promise<SafeUser | null> { return (await getAuth())?.user ?? null; }
