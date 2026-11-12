import type { Config, Context } from "@netlify/functions";
import { configured, imageStore, isAdmin, json, sameOrigin } from "../lib/common.mts";

const MAX_BYTES = 4_000_000;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const KEY_RE = /^[a-z0-9-]{20,60}\.(jpg|png|webp)$/;

function matchesType(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}

export default async (req: Request, context: Context) => {
  /* serve an image */
  if (req.method === "GET") {
    const key = context.params?.key ?? "";
    if (!KEY_RE.test(key)) return new Response("Not found", { status: 404 });
    const entry = await imageStore().getWithMetadata(key, { type: "arrayBuffer" });
    if (!entry) return new Response("Not found", { status: 404 });
    return new Response(entry.data as ArrayBuffer, {
      headers: {
        "content-type": String(entry.metadata?.contentType ?? "application/octet-stream"),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }

  /* upload an image (admin only) */
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!configured()) return json({ error: "not_configured" }, 500);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = TYPES[type];
  if (!ext) return json({ error: "image_type" }, 400);

  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return json({ error: "image_size" }, 400);
  if (!matchesType(new Uint8Array(buf, 0, Math.min(buf.byteLength, 12)), type)) return json({ error: "image_type" }, 400);

  const key = `${crypto.randomUUID()}.${ext}`;
  await imageStore().set(key, buf, { metadata: { contentType: type } });
  return json({ url: `/api/img/${key}` }, 201);
};

export const config: Config = {
  path: ["/api/upload", "/api/img/:key"],
};
