import { getStore } from "@netlify/blobs";

export const newsStore = () => getStore({ name: "news", consistency: "strong" });
export const imageStore = () => getStore({ name: "images", consistency: "strong" });

export const CATEGORIES = [
  "ეროვნული ლიგა",
  "ტრანსფერები",
  "ნაკრები",
  "მიმოხილვა",
  "ინტერვიუ",
  "ანალიტიკა",
  "სხვა",
];

export type Meta = {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  image: string;
  featured: boolean;
  published: boolean;
  date: string;
  updated: string;
};

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- index (list of article metadata) ---------- */

export async function readIndex(): Promise<Meta[]> {
  const list = (await newsStore().get("index", { type: "json" })) as Meta[] | null;
  return Array.isArray(list) ? list : [];
}

export async function writeIndex(list: Meta[]) {
  list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  await newsStore().setJSON("index", list);
}

export async function readBody(id: string): Promise<string> {
  const doc = (await newsStore().get("a/" + id, { type: "json" })) as { body?: string } | null;
  return doc?.body ?? "";
}

/* ---------- validation ---------- */

const IMAGE_RE = /^\/api\/img\/[a-z0-9-]{20,60}\.(jpg|png|webp)$/;

export function validate(input: any): { error: string } | { value: { meta: Omit<Meta, "id" | "date" | "updated">; body: string } } {
  if (!input || typeof input !== "object") return { error: "bad_request" };
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const category = typeof input.category === "string" ? input.category : "";
  const excerpt = typeof input.excerpt === "string" ? input.excerpt.trim() : "";
  const body = typeof input.body === "string" ? input.body.replace(/\r\n/g, "\n").trim() : "";
  const image = typeof input.image === "string" ? input.image : "";

  if (title.length < 3 || title.length > 200) return { error: "title_length" };
  if (!CATEGORIES.includes(category)) return { error: "category" };
  if (excerpt.length > 300) return { error: "excerpt_length" };
  if (body.length < 1 || body.length > 20000) return { error: "body_length" };
  if (image && !IMAGE_RE.test(image)) return { error: "image" };

  return {
    value: {
      meta: {
        title,
        category,
        excerpt,
        image,
        featured: input.featured === true,
        published: input.published !== false,
      },
      body,
    },
  };
}

/* ---------- admin session ---------- */

const COOKIE = "sektori_admin";
const TTL = 60 * 60 * 24 * 14; // 14 days
const enc = new TextEncoder();

export function configured(): boolean {
  const pw = Netlify.env.get("ADMIN_PASSWORD") ?? "";
  const secret = Netlify.env.get("SESSION_SECRET") ?? "";
  return pw.length >= 8 && secret.length >= 16;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(data: string): Promise<string> {
  const secret = Netlify.env.get("SESSION_SECRET") ?? "";
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = Netlify.env.get("ADMIN_PASSWORD") ?? "";
  const [x, y] = await Promise.all([sign("pw:" + input), sign("pw:" + expected)]);
  return safeEqual(x, y);
}

export async function sessionCookie(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const sig = await sign("s:" + exp);
  return `${COOKIE}=${exp}.${sig}; Path=/; Max-Age=${TTL}; HttpOnly; Secure; SameSite=Strict`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export async function isAdmin(req: Request): Promise<boolean> {
  if (!configured()) return false;
  const header = req.headers.get("cookie") ?? "";
  const part = header.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!part) return false;
  const [exp, sig] = part.slice(COOKIE.length + 1).split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await sign("s:" + exp));
}

/** CSRF guard for state-changing requests (cookie is also SameSite=Strict). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}
