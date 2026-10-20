import { SESSION_COOKIE } from "@/lib/auth/session";
import { jsonOk } from "@/lib/api/json";

export async function POST() {
  const response = jsonOk({ ok: true as const });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
