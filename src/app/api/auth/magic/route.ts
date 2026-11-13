import { NextResponse } from "next/server";
import { consumeMagicToken } from "@/server/actions/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const target = await consumeMagicToken(token);
    return NextResponse.redirect(new URL(target, request.url));
  } catch (error: unknown) {
    logger.warn("magic link gagal", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.redirect(new URL("/login?error=magic", request.url));
  }
}
