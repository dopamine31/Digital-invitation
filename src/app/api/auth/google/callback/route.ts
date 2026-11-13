import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { completeGoogleSignIn } from "@/server/actions/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("rasa_oauth_state")?.value ?? "";
  if (!code || !state || state !== expected) return NextResponse.redirect(new URL("/login?error=google_state", request.url));
  try {
    const target = await completeGoogleSignIn(code);
    const response = NextResponse.redirect(new URL(target, request.url));
    response.cookies.delete("rasa_oauth_state");
    return response;
  } catch (error: unknown) {
    logger.warn("OAuth Google gagal", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.redirect(new URL("/login?error=google", request.url));
  }
}
