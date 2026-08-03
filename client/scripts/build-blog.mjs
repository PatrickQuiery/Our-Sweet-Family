// Static blog generator. Reads Markdown posts from content/blog/*.md and writes
// fully-rendered, crawlable static HTML into public/blog/ (index + one page per
// post) plus a refreshed sitemap.xml. These are plain files served directly by
// Vercel — deliberately NOT part of the React SPA — so search engines and link
// scrapers get real HTML. Re-run after adding/editing posts:  node scripts/build-blog.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { marked } from 'marked';

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(__dir, '../content/blog');
const OUT = join(__dir, '../public/blog');
const SITE = 'https://oursweetfamily.com';
const OG = `${SITE}/og-image.png`;

// Non-marketing/static routes the sitemap should keep listing.
const STATIC_ROUTES = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/signup', priority: '0.9', changefreq: 'monthly' },
  { loc: '/blog', priority: '0.8', changefreq: 'weekly' },
  { loc: '/login', priority: '0.5', changefreq: 'monthly' },
  { loc: '/privacy', priority: '0.5', changefreq: 'yearly' },
  { loc: '/contact', priority: '0.4', changefreq: 'yearly' },
];

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parse(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
    }
    meta[line.slice(0, i).trim()] = v;
  }
  return { meta, body: m[2] };
}

const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

const HEAD = ({ title, description, canonical }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#f43f74" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Our Sweet Family" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${OG}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${OG}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/blog/blog.css" />
</head>`;

const HEADER = `<header class="site-header">
  <a class="brand" href="/"><img src="/logo.svg" alt="Our Sweet Family" width="36" height="36" /><span>Our Sweet Family</span></a>
  <a class="btn btn-primary" href="/signup">Get started free</a>
</header>`;

const FOOTER = `<footer class="site-footer">
  <nav><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a><a href="/signup">Get started</a></nav>
  <p>&copy; ${new Date().getFullYear()} Our Sweet Family. A private, ad-free home for your family's memories.</p>
</footer>`;

const CTA = `<aside class="cta">
  <h3>Give your family's photos a private home</h3>
  <p>Ad-free, invite-only, organized by child with automatic age labels.</p>
  <a class="btn btn-primary" href="/signup">Start free — no card needed</a>
</aside>`;

function postPage(p) {
  const canonical = `${SITE}/blog/${p.slug}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: p.title, description: p.description, datePublished: p.date,
    image: OG, mainEntityOfPage: canonical,
    publisher: { '@type': 'Organization', name: 'Our Sweet Family', logo: { '@type': 'ImageObject', url: `${SITE}/logo.svg` } },
  };
  return `${HEAD({ title: `${p.title} — Our Sweet Family`, description: p.description, canonical })}
<body>
${HEADER}
<main class="prose">
  <a class="back" href="/blog">← All articles</a>
  <p class="date">${fmtDate(p.date)}</p>
  <h1>${esc(p.title)}</h1>
  <article>${p.html}</article>
  ${CTA}
</main>
${FOOTER}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</body></html>`;
}

function indexPage(posts) {
  const canonical = `${SITE}/blog`;
  const cards = posts.map((p) => `<a class="card" href="/blog/${p.slug}">
    <p class="date">${fmtDate(p.date)}</p>
    <h2>${esc(p.title)}</h2>
    <p class="excerpt">${esc(p.excerpt || p.description)}</p>
    <span class="more">Read more →</span>
  </a>`).join('\n');
  return `${HEAD({ title: 'The Our Sweet Family Blog — Private Family Photo Sharing Tips', description: 'Guides on sharing your kids’ photos privately, keeping memories organized, and getting the most out of family photo sharing.', canonical })}
<body>
${HEADER}
<main class="blog-index">
  <div class="index-hero">
    <h1>The Our Sweet Family Blog</h1>
    <p>Sharing your kids' photos privately, keeping the memories organized, and everything in between.</p>
  </div>
  <div class="cards">${cards}</div>
</main>
${FOOTER}
</body></html>`;
}

const CSS = `:root{--brand:#f43f74;--brand-d:#be1249;--ink:#111827;--muted:#6b7280;--bg:#fff;--soft:#f9fafb}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.65}
a{color:inherit}img{max-width:100%}
.site-header{display:flex;align-items:center;justify-content:space-between;max-width:820px;margin:0 auto;padding:18px 24px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:800}
.btn{display:inline-block;padding:9px 18px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px}
.btn-primary{background:var(--brand);color:#fff}.btn-primary:hover{background:var(--brand-d)}
.prose{max-width:720px;margin:0 auto;padding:24px 24px 64px}
.prose h1{font-size:2.1rem;font-weight:800;line-height:1.2;margin:.2em 0 .6em}
.prose h2{font-size:1.4rem;font-weight:700;margin:1.8em 0 .5em}
.prose article p{margin:1em 0;color:#374151}
.prose article ul,.prose article ol{color:#374151;padding-left:1.3em}.prose article li{margin:.4em 0}
.prose article strong{color:var(--ink)}
.prose article a{color:var(--brand-d);font-weight:600}
.prose hr{border:none;border-top:1px solid #eee;margin:2em 0}
.date{color:var(--muted);font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin:0}
.back{display:inline-block;color:var(--muted);text-decoration:none;font-size:.9rem;margin-bottom:1.5em}
.back:hover{color:var(--brand-d)}
.cta{background:linear-gradient(135deg,#fff1f5,#ffe4ec);border:1px solid #fecdd8;border-radius:20px;padding:28px;margin:3em 0 0;text-align:center}
.cta h3{margin:.2em 0;font-size:1.3rem}.cta p{color:#4b5563;margin:.4em 0 1.2em}
.blog-index{max-width:820px;margin:0 auto;padding:16px 24px 64px}
.index-hero{text-align:center;padding:24px 0 40px}
.index-hero h1{font-size:2.4rem;font-weight:800;margin:.2em 0}
.index-hero p{color:var(--muted);font-size:1.1rem;max-width:520px;margin:0 auto}
.cards{display:grid;gap:18px}
.card{display:block;text-decoration:none;border:1px solid #eef0f2;border-radius:18px;padding:24px;transition:box-shadow .2s,border-color .2s;background:#fff}
.card:hover{box-shadow:0 10px 30px rgba(0,0,0,.06);border-color:#fecdd8}
.card h2{margin:.3em 0;font-size:1.35rem}.card .excerpt{color:#4b5563;margin:.4em 0 1em}
.card .more{color:var(--brand-d);font-weight:600;font-size:.92rem}
.site-footer{border-top:1px solid #f0f0f0;padding:28px 24px;text-align:center;color:var(--muted);font-size:.9rem}
.site-footer nav{display:flex;gap:18px;justify-content:center;margin-bottom:10px;flex-wrap:wrap}
.site-footer nav a{text-decoration:none;color:var(--muted)}.site-footer nav a:hover{color:var(--brand-d)}`;

// ---- build ----
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'blog.css'), CSS);

const posts = readdirSync(CONTENT)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { meta, body } = parse(readFileSync(join(CONTENT, f), 'utf8'));
    return { ...meta, slug: f.replace(/\.md$/, ''), html: marked.parse(body) };
  })
  .sort((a, b) => (a.date < b.date ? 1 : -1));

for (const p of posts) {
  mkdirSync(join(OUT, p.slug), { recursive: true });
  writeFileSync(join(OUT, p.slug, 'index.html'), postPage(p));
}
writeFileSync(join(OUT, 'index.html'), indexPage(posts));

// sitemap = static routes + posts
const today = new Date().toISOString().slice(0, 10);
const urls = [
  ...STATIC_ROUTES.map((r) => ({ loc: r.loc, lastmod: today, changefreq: r.changefreq, priority: r.priority })),
  ...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: p.date, changefreq: 'yearly', priority: '0.7' })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(__dir, '../public/sitemap.xml'), sitemap);

console.log(`Built ${posts.length} post(s) + index + sitemap:`);
posts.forEach((p) => console.log(`  /blog/${p.slug}`));
