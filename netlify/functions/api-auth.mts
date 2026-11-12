import type { Config } from "@netlify/functions";
import { checkPassword, clearCookie, configured, isAdmin, json, sameOrigin, sessionCookie } from "../lib/common.mts";

export default async (req: Request) => {
  const path = new URL(req.url).pathname;

  if (path === "/api/me") {
    return json({ admin: await isAdmin(req), configured: configured() });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);

  if (path === "/api/logout") {
    return json({ ok: true }, 200, { "set-cookie": clearCookie() });
  }

  // /api/login
  if (!configured()) return json({ error: "not_configured" }, 500);
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  if (!(await checkPassword(password))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return json({ error: "wrong_password" }, 401);
  }
  return json({ ok: true }, 200, { "set-cookie": await sessionCookie() });
};

export const config: Config = {
  path: ["/api/login", "/api/logout", "/api/me"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 20 },
};
