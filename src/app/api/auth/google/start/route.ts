import { NextResponse } from "next/server";
import { googleAuthUrl } from "@/lib/auth";
import { hmac, randomToken } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const state = `${randomToken(8)}.${hmac(randomToken(8))}`;
  const url = googleAuthUrl(state);
  if (!url) return NextResponse.redirect(new URL("/login?error=google", request.url));
  const response = NextResponse.redirect(url);
  response.cookies.set("rasa_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return response;
}
