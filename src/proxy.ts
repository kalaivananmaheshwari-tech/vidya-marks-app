import { NextResponse, type NextRequest } from "next/server";
import { allowedRequestOrigin } from "@/lib/security";

export function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (!isApi) return NextResponse.next();
  const production = process.env.NODE_ENV === "production";
  const origins = (process.env.APP_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  const publicOperational = ["/api/health", "/api/openapi"].includes(request.nextUrl.pathname);
  if (production && !origins.length && !publicOperational) return NextResponse.json({ error: "Application origin must be configured before protected production routes are enabled.", code: "ORIGIN_NOT_CONFIGURED" }, { status: 503 });
  if (!allowedRequestOrigin(request, production, origins)) return NextResponse.json({ error: "Request origin is not authorized.", code: "FORBIDDEN_ORIGIN" }, { status: 403 });
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 405 });
  // Same-origin only. No wildcard or reflected Access-Control-Allow-Origin header.
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  return response;
}
export const config = { matcher: ["/api/:path*"] };
