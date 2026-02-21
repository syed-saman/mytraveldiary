// ═══════════════════════════════════════════════════════════════════
// Wanderlust Chronicles — Static Site Generator
// Run:  node build.js
// Reads data/posts.json + data/categories.json
// Writes fully-static HTML into docs/
// docs/ is what GitHub Pages serves (set Pages source to /docs)
// ═══════════════════════════════════════════════════════════════════

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT   = __dirname;
const DATA   = path.join(ROOT, 'data');
const DOCS   = path.join(ROOT, 'docs');
const UPLSRC = path.join(ROOT, 'docs', 'uploads'); // already in docs/

// ── Helpers ──────────────────────────────────────────────────────
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); } catch { return []; }
}
function writeFile(relPath, content) {
  const full = path.join(DOCS, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}
function escHtml(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }); }
  catch { return ''; }
}
function fmtDateShort(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return ''; }
}
function youtubeId(url = '') {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Shared HTML shell ────────────────────────────────────────────
const GA = `<!-- Add your Google Analytics tag here if needed -->`;
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">`;
const CSS = `<link rel="stylesheet" href="/css/style.css">`;

function head(title, desc = '', canonical = '') {
  return `<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} | Wanderlust Chronicles</title>
${desc ? `<meta name="description" content="${escHtml(desc)}">` : ''}
${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
${FONTS}
${CSS}
${GA}
</head>`;
}

function nav(active = '') {
  return `<header class="site-header">
  <div class="container">
    <a href="/" class="logo"><span class="logo-icon">✦</span> Wanderlust Chronicles</a>
    <nav class="main-nav">
      <a href="/" ${active==='home'?'style="color:var(--color-accent)"':''}>Home</a>
      <a href="/blog/" ${active==='blog'?'style="color:var(--color-accent)"':''}>Blog</a>
      <a href="/about/" ${active==='about'?'style="color:var(--color-accent)"':''}>About</a>
    </nav>
    <button class="mobile-toggle" onclick="this.nextElementSibling&&document.querySelector('.main-nav').classList.toggle('open')" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>`;
}

function footer(categories = []) {
  const catLinks = categories.map(c =>
    `<a href="/blog/?category=${c.id}">${escHtml(c.name)}</a>`
  ).join('\n      ');
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <h3>✦ Wanderlust Chronicles</h3>
        <p>Sharing stories, discoveries, and the joy of exploring our beautiful world — one journey at a time.</p>
      </div>
      <div class="footer-col">
        <h4>Quick Links</h4>
        <a href="/">Home</a>
        <a href="/blog/">Blog</a>
        <a href="/about/">About</a>
      </div>
      <div class="footer-col">
        <h4>Categories</h4>
        ${catLinks || '<a href="/blog/">All Posts</a>'}
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; ${new Date().getFullYear()} Wanderlust Chronicles. All rights reserved.</p>
    </div>
  </div>
</footer>`;
}

function postCard(post, categories) {
  const cat  = categories.find(c => c.id === post.categoryId);
  const img  = post.featuredImage || '/uploads/default-travel.jpg';
  const date = fmtDateShort(post.createdAt);
  return `<article class="post-card">
  <a href="/blog/${post.slug}/" class="post-card-image" style="background-image:url('${escHtml(img)}')">
    ${cat ? `<span class="post-card-category">${escHtml(cat.name)}</span>` : ''}
  </a>
  <div class="post-card-content">
    <time datetime="${post.createdAt}">${date}</time>
    <h3><a href="/blog/${post.slug}/">${escHtml(post.title)}</a></h3>
    <p>${escHtml(post.excerpt || '')}</p>
    <a href="/blog/${post.slug}/" class="read-more">Read More →</a>
  </div>
</article>`;
}

// ══════════════════════════════════════════════════════════════════
//  PAGE GENERATORS
// ══════════════════════════════════════════════════════════════════

// ── Home page ─────────────────────────────────────────────────────
function buildHome(posts, categories) {
  const published = posts.filter(p => p.status === 'published')
                         .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const featured  = published[0];
  const recent    = published.slice(1, 7);

  const heroSection = featured ? `
<section class="hero" style="background-image:linear-gradient(to top,rgba(0,0,0,.7) 0,rgba(0,0,0,.2) 60%,transparent),url('${escHtml(featured.featuredImage || '')}')">
  <div class="hero-content">
    <span class="hero-label">Featured</span>
    <h1>${escHtml(featured.title)}</h1>
    <p>${escHtml(featured.excerpt || '')}</p>
    <a href="/blog/${featured.slug}/" class="btn">Read Story</a>
  </div>
</section>` : `
<section class="hero" style="background:var(--color-dark);display:flex;align-items:center;justify-content:center;min-height:420px">
  <div style="text-align:center;color:white;padding:40px">
    <h1 style="font-family:var(--font-heading);font-size:3rem;margin-bottom:16px">Wanderlust Chronicles</h1>
    <p style="font-size:1.15rem;opacity:.8;margin-bottom:24px">Stories from the road, waiting to be told.</p>
    <a href="/about/" class="btn">About This Blog</a>
  </div>
</section>`;

  const recentSection = recent.length ? `
<section class="section">
  <div class="container">
    <div class="section-header">
      <h2>Recent Stories</h2>
      <a href="/blog/" class="view-all">View All →</a>
    </div>
    <div class="post-grid">
      ${recent.map(p => postCard(p, categories)).join('\n      ')}
    </div>
  </div>
</section>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
${head('Home — Travel Stories & Adventures', 'Wanderlust Chronicles — sharing stories, discoveries, and the joy of exploring our world.')}
<body>
${nav('home')}
${heroSection}
${recentSection}
${footer(categories)}
<script>
document.querySelector('.mobile-toggle').addEventListener('click', () => {
  document.querySelector('.main-nav').classList.toggle('open');
});
</script>
</body>
</html>`;
  writeFile('index.html', html);
  console.log('  ✓ docs/index.html');
}

// ── Blog listing ──────────────────────────────────────────────────
function buildBlog(posts, categories) {
  const published = posts.filter(p => p.status === 'published')
                         .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const catOpts = categories.map(c =>
    `<option value="${c.id}">${escHtml(c.name)}</option>`
  ).join('');

  const cards = published.length
    ? published.map(p => postCard(p, categories)).join('\n      ')
    : '<div class="empty-state">No posts yet — check back soon!</div>';

  // Embed all post data for client-side filtering
  const postsJson = JSON.stringify(published.map(p => ({
    id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt,
    featuredImage: p.featuredImage, categoryId: p.categoryId,
    tags: p.tags || [], createdAt: p.createdAt,
  })));
  const catsJson = JSON.stringify(categories);

  const html = `<!DOCTYPE html>
<html lang="en">
${head('Blog — All Stories', 'Browse all travel stories and adventures on Wanderlust Chronicles.')}
<body>
${nav('blog')}
<div class="page-header">
  <div class="container">
    <h1>All Stories</h1>
    <p>${published.length} adventure${published.length !== 1 ? 's' : ''} and counting</p>
  </div>
</div>
<section class="section">
  <div class="container">
    <div class="blog-toolbar">
      <form class="search-form" onsubmit="filterPosts(event)">
        <input type="text" id="search" placeholder="Search stories…" oninput="filterPosts()">
        <button type="submit">Search</button>
      </form>
      <div class="filter-bar">
        <button class="filter-btn active" onclick="setFilter('',this)">All</button>
        ${categories.map(c =>
          `<button class="filter-btn" onclick="setFilter('${c.id}',this)">${escHtml(c.name)}</button>`
        ).join('\n        ')}
      </div>
    </div>
    <div class="post-grid" id="grid">
      ${cards}
    </div>
  </div>
</section>
${footer(categories)}
<script>
const ALL_POSTS = ${postsJson};
const ALL_CATS  = ${catsJson};
let activeCategory = '';

// Read ?category= from URL on load
(function(){
  const p = new URLSearchParams(location.search);
  const c = p.get('category');
  if(c){ activeCategory = c; document.querySelectorAll('.filter-btn').forEach(b=>{ b.classList.toggle('active', b.textContent.trim() === (ALL_CATS.find(x=>x.id===c)||{}).name); }); filterPosts(); }
})();

function setFilter(catId, btn){
  activeCategory = catId;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  filterPosts();
}

function filterPosts(e){ if(e)e.preventDefault(); render(); }

function render(){
  const q = document.getElementById('search').value.toLowerCase();
  let posts = ALL_POSTS;
  if(activeCategory) posts = posts.filter(p=>p.categoryId===activeCategory);
  if(q) posts = posts.filter(p=> p.title.toLowerCase().includes(q)||p.excerpt.toLowerCase().includes(q)||(p.tags||[]).some(t=>t.toLowerCase().includes(q)));
  const grid = document.getElementById('grid');
  if(!posts.length){ grid.innerHTML='<div class="empty-state">No stories match your search.</div>'; return; }
  grid.innerHTML = posts.map(p=>{
    const cat = ALL_CATS.find(c=>c.id===p.categoryId);
    const img = p.featuredImage||'/uploads/default-travel.jpg';
    const date = new Date(p.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
    return \`<article class="post-card">
  <a href="/blog/\${p.slug}/" class="post-card-image" style="background-image:url('\${img}')">
    \${cat?'<span class="post-card-category">'+cat.name+'</span>':''}
  </a>
  <div class="post-card-content">
    <time>\${date}</time>
    <h3><a href="/blog/\${p.slug}/">\${p.title}</a></h3>
    <p>\${p.excerpt||''}</p>
    <a href="/blog/\${p.slug}/" class="read-more">Read More →</a>
  </div>
</article>\`;
  }).join('');
}
document.querySelector('.mobile-toggle').addEventListener('click', () => {
  document.querySelector('.main-nav').classList.toggle('open');
});
</script>
</body>
</html>`;
  writeFile('blog/index.html', html);
  console.log('  ✓ docs/blog/index.html');
}

// ── Individual post pages ─────────────────────────────────────────
function buildPost(post, allPublished, categories) {
  const cat = categories.find(c => c.id === post.categoryId);
  const idx = allPublished.findIndex(p => p.id === post.id);
  const prev = allPublished[idx + 1]; // older
  const next = allPublished[idx - 1]; // newer

  const ytId = youtubeId(post.youtubeUrl);
  const youtubeBlock = ytId ? `
<div class="youtube-embed">
  <iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe>
</div>` : '';

  const tagsBlock = (post.tags || []).length ? `
<div class="post-tags">
  ${post.tags.map(t => `<span class="tag">#${escHtml(t)}</span>`).join(' ')}
</div>` : '';

  const navBlock = `
<div class="post-navigation">
  ${prev ? `<a href="/blog/${prev.slug}/" class="nav-prev"><span>← Previous</span><strong>${escHtml(prev.title)}</strong></a>` : '<span></span>'}
  ${next ? `<a href="/blog/${next.slug}/" class="nav-next"><span>Next →</span><strong>${escHtml(next.title)}</strong></a>` : '<span></span>'}
</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
${head(post.title, post.excerpt || '', `https://YOUR-USERNAME.github.io/blog/${post.slug}/`)}
<body>
<article class="single-post">
${nav('blog')}
${post.featuredImage ? `<div class="post-hero" style="background-image:url('${escHtml(post.featuredImage)}')"></div>` : '<div style="margin-top:70px"></div>'}
<div class="post-container">
  <header class="post-header">
    ${cat ? `<a href="/blog/?category=${cat.id}" class="post-category-link">${escHtml(cat.name)}</a>` : ''}
    <h1>${escHtml(post.title)}</h1>
    <div class="post-meta">
      <time datetime="${post.createdAt}">${fmtDate(post.createdAt)}</time>
      ${post.updatedAt && post.updatedAt !== post.createdAt
        ? `<span class="meta-sep">·</span><span>Updated ${fmtDateShort(post.updatedAt)}</span>`
        : ''}
    </div>
  </header>
  <div class="post-content">
    ${post.content || ''}
    ${youtubeBlock}
  </div>
  ${tagsBlock}
  ${navBlock}
</div>
</article>
${footer(categories)}
<script>
document.querySelector('.mobile-toggle').addEventListener('click', () => {
  document.querySelector('.main-nav').classList.toggle('open');
});
</script>
</body>
</html>`;
  writeFile(`blog/${post.slug}/index.html`, html);
  console.log(`  ✓ docs/blog/${post.slug}/index.html`);
}

// ── About page ────────────────────────────────────────────────────
function buildAbout(categories) {
  const html = `<!DOCTYPE html>
<html lang="en">
${head('About', 'Learn about Wanderlust Chronicles and the person behind the stories.')}
<body>
${nav('about')}
<div class="page-header">
  <div class="container">
    <h1>About</h1>
    <p>The story behind the stories</p>
  </div>
</div>
<section class="section">
  <div class="container about-container">
    <div class="about-content">
      <div class="about-image">
        <img src="/uploads/about-photo.jpg" alt="About photo" onerror="this.style.display='none'">
      </div>
      <div class="about-text">
        <h2>Hello, I'm a wanderer.</h2>
        <p>Welcome to Wanderlust Chronicles — a space where travel stories come to life. From bustling city streets to remote mountain trails, I share every adventure, discovery, and lesson learned along the way.</p>
        <h3>Why I travel</h3>
        <p>Travel has a way of reshaping how we see the world and ourselves. Every destination offers a new perspective, a new flavour, and new friendships.</p>
        <h3>What you'll find here</h3>
        <p>Honest travel stories, practical tips, cultural insights, and photography from around the globe. No sponsored fluff — just real experiences.</p>
        <p style="margin-top:24px"><a href="/blog/" class="btn">Read the Blog →</a></p>
      </div>
    </div>
  </div>
</section>
${footer(categories)}
<script>
document.querySelector('.mobile-toggle').addEventListener('click', () => {
  document.querySelector('.main-nav').classList.toggle('open');
});
</script>
</body>
</html>`;
  writeFile('about/index.html', html);
  console.log('  ✓ docs/about/index.html');
}

// ── 404 page ──────────────────────────────────────────────────────
function build404(categories) {
  const html = `<!DOCTYPE html>
<html lang="en">
${head('404 — Page Not Found')}
<body>
${nav()}
<div style="text-align:center;padding:140px 20px 80px">
  <h1 style="font-family:var(--font-heading);font-size:6rem;color:var(--color-accent);line-height:1">404</h1>
  <p style="font-size:1.2rem;color:var(--color-text-light);margin-bottom:28px">Looks like this path leads nowhere.</p>
  <a href="/" class="btn">Back to Home</a>
</div>
${footer(categories)}
</body>
</html>`;
  writeFile('404.html', html);
  console.log('  ✓ docs/404.html');
}

// ══════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════
function build() {
  console.log('\n  🔨 Building static site…\n');

  const posts      = readJSON('posts.json');
  const categories = readJSON('categories.json');
  const published  = posts.filter(p => p.status === 'published')
                          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Ensure docs/ structure exists
  fs.mkdirSync(path.join(DOCS, 'blog'),   { recursive: true });
  fs.mkdirSync(path.join(DOCS, 'about'),  { recursive: true });
  fs.mkdirSync(path.join(DOCS, 'uploads'),{ recursive: true });

  buildHome(published, categories);
  buildBlog(posts, categories);
  published.forEach(p => buildPost(p, published, categories));
  buildAbout(categories);
  build404(categories);

  console.log(`\n  ✅ Done — ${published.length} post(s) built into docs/`);
  console.log('  📤 Commit docs/ and push → GitHub Pages will serve it.\n');
}

build();
