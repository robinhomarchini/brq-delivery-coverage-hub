import { NextResponse, type NextRequest } from "next/server";

const isProduction = process.env.NODE_ENV === "production";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
    },
  ],
};

function buildContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src ${["'self'", `'nonce-${nonce}'`, isProduction ? "" : "'unsafe-eval'"].filter(Boolean).join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${["'self'", supabaseOrigin, "wss://*.supabase.co"].filter(Boolean).join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
