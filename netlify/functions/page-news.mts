import type { Config, Context } from "@netlify/functions";
import { esc, readBody, readIndex, type Meta } from "../lib/common.mts";

const CSS = `
:root{--g:#12a150;--gl:#7bd9a1;--r:#d8232a;--bg:#0b0d0c;--card:#141816;--line:#26302a;--mute:#8a9a8f;--text:#f3f5f2;--soft:#b8c4bb}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Noto Sans Georgian',system-ui,sans-serif;line-height:1.7}
a{color:inherit;text-decoration:none}a:hover{color:#ff4a50}
img{max-width:100%;display:block}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}
header{border-bottom:3px solid var(--g)}
.head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px}
.logo{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:800}
.logo b{width:40px;height:40px;background:var(--g);color:var(--bg);display:flex;align-items:center;justify-content:center;font-size:20px}
.logo span span{color:var(--g)}
.back{font-weight:700;font-size:14px;color:var(--gl)}
.tag{display:inline-block;background:var(--r);color:#fff;font-size:12px;font-weight:700;padding:3px 10px}
h1{font-size:30px;line-height:1.35;margin:14px 0 8px;font-weight:800}
.date{color:var(--mute);font-size:14px}
.cover{margin:20px 0;width:100%;max-height:480px;object-fit:cover}
.lead{font-size:18px;color:var(--soft);font-weight:500}
.text p{margin:0 0 18px;font-size:17px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;margin:24px 0}
.card{background:var(--card);border-top:4px solid var(--g);display:block}
.card:nth-child(even){border-top-color:var(--r)}
.card .ph{height:150px;background:#1b2a21}
.card .ph img{width:100%;height:100%;object-fit:cover}
.card .body{padding:16px}
.card small{font-size:12px;font-weight:700;color:var(--g)}
.card h2{margin:6px 0 0;font-size:17px;line-height:1.4;font-weight:700}
footer{margin-top:48px;background:#050606;border-top:3px solid var(--r);color:var(--mute);font-size:14px;padding:24px 20px;text-align:center}
`;

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ka-GE", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tbilisi" });
  } catch {
    return iso.slice(0, 10);
  }
}

function layout(o: { title: string; desc: string; canonical: string; image?: string; ld?: unknown; main: string; type?: string }): string {
  return `<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${esc(o.canonical)}">
<meta property="og:type" content="${o.type ?? "website"}">
<meta property="og:site_name" content="სექტორი.ge">
<meta property="og:locale" content="ka_GE">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${esc(o.canonical)}">
${o.image ? `<meta property="og:image" content="${esc(o.image)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;500;700;800&display=swap" rel="stylesheet">
${o.ld ? `<script type="application/ld+json">${JSON.stringify(o.ld).replace(/</g, "\\u003c")}</script>` : ""}
<style>${CSS}</style>
</head>
<body>
<header><div class="head wrap" style="max-width:1100px">
  <a class="logo" href="/"><b>S</b><span>სექტორი<span>.ge</span></span></a>
  <a class="back" href="/news">ყველა სიახლე</a>
</div></header>
${o.main}
<footer>სექტორი.ge · ქართული სპორტის სიახლეები და ლაივ ცხრილი</footer>
</body>
</html>`;
}

function html(body: string, status = 200, cache = "public, max-age=60"): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });
}

function card(m: Meta): string {
  return `<a class="card" href="/news/${esc(m.id)}"><div class="ph">${
    m.image ? `<img src="${esc(m.image)}" alt="${esc(m.title)}" loading="lazy">` : ""
  }</div><div class="body"><small>${esc(m.category)}</small><h2>${esc(m.title)}</h2></div></a>`;
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const origin = url.origin;
  const index = (await readIndex()).filter((m) => m.published);

  /* ---------- sitemap ---------- */
  if (url.pathname === "/sitemap-news.xml") {
    const items = index
      .slice(0, 1000)
      .map((m) => `<url><loc>${esc(origin)}/news/${esc(m.id)}</loc><lastmod>${esc(m.updated.slice(0, 10))}</lastmod></url>`)
      .join("");
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(origin)}/news</loc></url>${items}</urlset>`,
      { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } },
    );
  }

  /* ---------- archive: /news ---------- */
  const id = context.params?.id;
  if (!id) {
    const main = `<main class="wrap"><h1>სიახლეები</h1>${
      index.length ? `<div class="grid">${index.slice(0, 60).map(card).join("")}</div>` : `<p class="lead">სიახლეები მალე დაემატება.</p>`
    }</main>`;
    return html(
      layout({
        title: "სიახლეები · სექტორი.ge",
        desc: "ქართული სპორტის ბოლო სიახლეები: ეროვნული ლიგა, ტრანსფერები, ნაკრები, ანალიტიკა.",
        canonical: `${origin}/news`,
        main,
      }),
    );
  }

  /* ---------- article: /news/:id ---------- */
  const meta = index.find((m) => m.id === id);
  if (!meta) {
    return html(
      layout({ title: "გვერდი ვერ მოიძებნა · სექტორი.ge", desc: "გვერდი ვერ მოიძებნა.", canonical: `${origin}/news`, main: `<main class="wrap"><h1>გვერდი ვერ მოიძებნა</h1><p><a class="back" href="/">მთავარ გვერდზე დაბრუნება</a></p></main>` }),
      404,
      "no-store",
    );
  }

  const body = await readBody(id);
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const desc = meta.excerpt || body.replace(/\s+/g, " ").slice(0, 160);
  const absImage = meta.image ? origin + meta.image : undefined;
  const canonical = `${origin}/news/${meta.id}`;

  const main = `<main class="wrap"><article>
<span class="tag">${esc(meta.category)}</span>
<h1>${esc(meta.title)}</h1>
<div class="date"><time datetime="${esc(meta.date)}">${esc(fmtDate(meta.date))}</time></div>
${meta.image ? `<img class="cover" src="${esc(meta.image)}" alt="${esc(meta.title)}">` : ""}
${meta.excerpt ? `<p class="lead">${esc(meta.excerpt)}</p>` : ""}
<div class="text">${paragraphs}</div>
</article></main>`;

  return html(
    layout({
      title: `${meta.title} · სექტორი.ge`,
      desc,
      canonical,
      image: absImage,
      type: "article",
      main,
      ld: {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: meta.title,
        description: desc,
        datePublished: meta.date,
        dateModified: meta.updated,
        inLanguage: "ka",
        articleSection: meta.category,
        mainEntityOfPage: canonical,
        ...(absImage ? { image: [absImage] } : {}),
        author: { "@type": "Organization", name: "სექტორი.ge" },
        publisher: { "@type": "Organization", name: "სექტორი.ge" },
      },
    }),
  );
};

export const config: Config = {
  path: ["/news", "/news/:id", "/sitemap-news.xml"],
};
