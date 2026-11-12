import type { Config, Context } from "@netlify/functions";
import {
  CATEGORIES,
  configured,
  isAdmin,
  json,
  newsStore,
  readBody,
  readIndex,
  sameOrigin,
  validate,
  writeIndex,
} from "../lib/common.mts";

export default async (req: Request, context: Context) => {
  const id = context.params?.id;
  const admin = await isAdmin(req);
  const url = new URL(req.url);

  /* ---------- public reads ---------- */
  if (req.method === "GET") {
    const index = await readIndex();

    if (id) {
      const meta = index.find((m) => m.id === id);
      if (!meta || (!meta.published && !admin)) return json({ error: "not_found" }, 404);
      return json({ ...meta, body: await readBody(id) }, 200, {
        "cache-control": admin ? "no-store" : "public, max-age=60",
      });
    }

    const all = admin && url.searchParams.get("all") === "1";
    let list = all ? index : index.filter((m) => m.published);
    const category = url.searchParams.get("category");
    if (category && CATEGORIES.includes(category)) list = list.filter((m) => m.category === category);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 100);
    return json({ items: list.slice(0, limit) }, 200, {
      "cache-control": all ? "no-store" : "public, max-age=30",
    });
  }

  /* ---------- admin writes ---------- */
  if (!configured()) return json({ error: "not_configured" }, 500);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!admin) return json({ error: "unauthorized" }, 401);

  const store = newsStore();
  const index = await readIndex();

  if (req.method === "POST" && !id) {
    const v = validate(await req.json().catch(() => null));
    if ("error" in v) return json({ error: v.error }, 400);
    const now = new Date().toISOString();
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (v.value.meta.featured) index.forEach((m) => (m.featured = false));
    index.push({ id: newId, ...v.value.meta, date: now, updated: now });
    await store.setJSON("a/" + newId, { body: v.value.body });
    await writeIndex(index);
    return json({ ok: true, id: newId }, 201);
  }

  if (req.method === "PUT" && id) {
    const pos = index.findIndex((m) => m.id === id);
    if (pos < 0) return json({ error: "not_found" }, 404);
    const v = validate(await req.json().catch(() => null));
    if ("error" in v) return json({ error: v.error }, 400);
    if (v.value.meta.featured) index.forEach((m) => (m.featured = false));
    index[pos] = { ...index[pos], ...v.value.meta, updated: new Date().toISOString() };
    await store.setJSON("a/" + id, { body: v.value.body });
    await writeIndex(index);
    return json({ ok: true });
  }

  if (req.method === "DELETE" && id) {
    const next = index.filter((m) => m.id !== id);
    if (next.length === index.length) return json({ error: "not_found" }, 404);
    await store.delete("a/" + id);
    await writeIndex(next);
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config: Config = {
  path: ["/api/news", "/api/news/:id"],
};
