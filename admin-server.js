// ═══════════════════════════════════════════════════════════════════
// Wanderlust Chronicles — Local Admin Server
// Run:  node admin-server.js   (then open http://localhost:3001)
// Data is saved to data/ and images to docs/uploads/.
// When you're done editing, run:  node build.js
// ═══════════════════════════════════════════════════════════════════

'use strict';
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const url      = require('url');
const { createHash } = require('crypto');

const PORT       = 3001;
const DATA_DIR   = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'docs', 'uploads');

// ── Default admin credentials (change these!) ───────────────────
const ADMIN_EMAIL    = 'admin@wanderlust.com';
const ADMIN_PASSWORD = 'admin123';

[DATA_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── In-memory session store ──────────────────────────────────────
const sessions = {};

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { createdAt: Date.now() };
  return token;
}
function getSession(req) {
  const cookies = parseCookies(req);
  const t = cookies['adm'];
  return t && sessions[t] ? sessions[t] : null;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k) out[k] = decodeURIComponent(v || '');
  });
  return out;
}

// ── Data helpers ─────────────────────────────────────────────────
function readDB(file) {
  const fp = path.join(DATA_DIR, file);
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; }
}
function writeDB(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Body parser ──────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { resolve(JSON.parse(body.toString())); } catch { resolve({}); }
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        const p = new URLSearchParams(body.toString());
        const obj = {};
        for (const [k, v] of p) obj[k] = v;
        resolve(obj);
      } else {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// ── Response helpers ─────────────────────────────────────────────
function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function sendHTML(res, html, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(html);
}
function redirect(res, loc) {
  res.writeHead(302, { Location: loc });
  res.end();
}

// ══════════════════════════════════════════════════════════════════
//  SHARED CSS (injected into every admin page)
// ══════════════════════════════════════════════════════════════════
const SHARED_CSS = `
:root{--accent:#c8553d;--accent-h:#a94432;--dark:#1a1a1a;--border:#e8e4df;--bg:#f5f5f5;--card:#fff;--text:#2c2c2c;--muted:#6b6b6b;--r:8px;--tr:0.25s ease;--font:'Inter',-apple-system,sans-serif;--serif:'Lora',Georgia,serif;--head:'Playfair Display',Georgia,serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);color:var(--text);background:var(--bg);line-height:1.6;font-size:15px;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none;transition:color var(--tr)}
a:hover{color:var(--accent-h)}
/* layout */
.layout{display:flex;min-height:100vh}
.sidebar{width:220px;background:var(--dark);color:#fff;padding:0;position:fixed;top:0;bottom:0;left:0;overflow-y:auto;z-index:100}
.sidebar-logo{display:flex;align-items:center;gap:8px;padding:20px;font-family:var(--head);font-size:1.1rem;font-weight:600;border-bottom:1px solid rgba(255,255,255,.08)}
.sidebar-logo span{color:var(--accent)}
.sidebar nav a{display:block;padding:11px 20px;color:rgba(255,255,255,.6);font-size:.88rem;transition:all var(--tr)}
.sidebar nav a:hover,.sidebar nav a.active{color:#fff;background:rgba(255,255,255,.06);padding-left:26px}
.sidebar-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.08);margin-top:auto}
.sidebar-footer a{color:rgba(255,255,255,.4);font-size:.8rem}
.main{margin-left:220px;padding:32px 36px;flex:1;min-height:100vh}
/* buttons */
.btn{display:inline-block;padding:10px 22px;background:var(--accent);color:#fff;font-size:.85rem;font-weight:500;letter-spacing:.4px;border:2px solid var(--accent);border-radius:var(--r);cursor:pointer;transition:all var(--tr);font-family:var(--font);text-transform:uppercase}
.btn:hover{background:var(--accent-h);border-color:var(--accent-h);color:#fff;transform:translateY(-1px)}
.btn-outline{background:transparent;color:var(--accent)}
.btn-outline:hover{background:var(--accent);color:#fff}
.btn-sm{display:inline-block;padding:5px 12px;border:1px solid var(--border);border-radius:var(--r);font-size:.78rem;font-family:var(--font);cursor:pointer;background:#fff;color:var(--text);transition:var(--tr);text-decoration:none;margin-right:4px}
.btn-sm:hover{background:var(--dark);color:#fff;border-color:var(--dark)}
.btn-danger{color:#e74c3c;border-color:#e74c3c}
.btn-danger:hover{background:#e74c3c;color:#fff;border-color:#e74c3c}
/* cards / sections */
.card{background:var(--card);border-radius:var(--r);box-shadow:0 1px 4px rgba(0,0,0,.07);padding:24px}
.page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
.page-header h1{font-family:var(--head);font-size:1.7rem;font-weight:600}
/* stats */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
.stat{background:var(--card);border-radius:var(--r);box-shadow:0 1px 4px rgba(0,0,0,.07);padding:20px;text-align:center}
.stat b{display:block;font-family:var(--head);font-size:2rem;color:var(--accent);line-height:1}
.stat small{font-size:.8rem;color:var(--muted);margin-top:6px;display:block}
/* table */
.tbl{width:100%;border-collapse:collapse}
.tbl th{text-align:left;font-size:.75rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;padding:10px 14px;border-bottom:2px solid var(--border)}
.tbl td{padding:12px 14px;border-bottom:1px solid var(--border);font-size:.88rem}
.tbl tr:last-child td{border-bottom:none}
.badge{display:inline-block;padding:3px 9px;border-radius:50px;font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.badge-pub{background:#d4edda;color:#155724}
.badge-draft{background:#fff3cd;color:#856404}
/* forms */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.span2{grid-column:1/-1}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:.8rem;font-weight:500;color:var(--muted);margin-bottom:5px}
.fg input,.fg select,.fg textarea{width:100%;padding:10px 13px;border:1px solid var(--border);border-radius:var(--r);font-size:.9rem;font-family:var(--font);transition:border-color var(--tr);background:#fafafa}
.fg input:focus,.fg select:focus,.fg textarea:focus{outline:none;border-color:var(--accent)}
/* rich editor */
.toolbar{display:flex;flex-wrap:wrap;gap:3px;padding:8px;background:#fafafa;border:1px solid var(--border);border-bottom:none;border-radius:var(--r) var(--r) 0 0}
.toolbar button{padding:5px 10px;background:#fff;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:.75rem;font-family:var(--font);transition:var(--tr)}
.toolbar button:hover{background:var(--dark);color:#fff}
.toolbar-sep{width:1px;background:var(--border);margin:0 3px}
.editor{min-height:360px;padding:16px;border:1px solid var(--border);border-radius:0 0 var(--r) var(--r);font-family:var(--serif);font-size:.98rem;line-height:1.7;outline:none;background:#fff}
.editor:focus{border-color:var(--accent)}
.editor h2{font-size:1.4rem;margin:16px 0 8px}
.editor h3{font-size:1.15rem;margin:12px 0 6px}
.editor p{margin-bottom:10px}
.editor blockquote{margin:12px 0;padding:10px 18px;border-left:3px solid var(--accent);background:#faf9f6;font-style:italic}
/* image upload */
.img-area{border:2px dashed var(--border);border-radius:var(--r);padding:32px;text-align:center;cursor:pointer;transition:var(--tr);background:#fafafa}
.img-area:hover{border-color:var(--accent);background:rgba(200,85,61,.02)}
.img-area p{color:var(--muted);font-size:.88rem}
.preview{max-height:180px;border-radius:var(--r);margin:0 auto}
.form-actions{display:flex;gap:10px;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)}
/* notification */
.notif{position:fixed;top:18px;right:18px;z-index:9999;padding:12px 22px;border-radius:var(--r);font-size:.88rem;font-family:var(--font);box-shadow:0 4px 14px rgba(0,0,0,.15);animation:slideIn .3s ease}
.notif-ok{background:#27ae60;color:#fff}
.notif-err{background:#e74c3c;color:#fff}
@keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}
/* login */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)}
.login-box{background:#fff;padding:44px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);width:100%;max-width:380px;margin:20px}
.login-box h1{font-family:var(--head);font-size:1.5rem;text-align:center;margin-bottom:6px}
.login-box p{text-align:center;color:var(--muted);font-size:.85rem;margin-bottom:28px}
.err{color:#e74c3c;font-size:.82rem;text-align:center;margin-top:10px}
`;

// ══════════════════════════════════════════════════════════════════
//  HTML PAGES
// ══════════════════════════════════════════════════════════════════
function layout(title, body, active = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&family=Lora:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-logo">✦ <span>Wanderlust</span></div>
    <nav>
      <a href="/"        ${active==='dash'  ?'class="active"':''}>📊 Dashboard</a>
      <a href="/posts"   ${active==='posts' ?'class="active"':''}>📝 Posts</a>
      <a href="/posts/new" ${active==='new' ?'class="active"':''}>+ New Post</a>
      <a href="/categories" ${active==='cats'?'class="active"':''}>🏷 Categories</a>
    </nav>
    <div class="sidebar-footer">
      <a href="/logout">⎋ Logout</a>
      &nbsp;·&nbsp;
      <a href="http://localhost:3001" target="_blank">Port 3001</a>
    </div>
  </aside>
  <main class="main">${body}</main>
</div>
<script>
function notify(msg,type='ok'){
  document.querySelectorAll('.notif').forEach(n=>n.remove());
  const d=document.createElement('div');
  d.className='notif notif-'+type;d.textContent=msg;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(),3200);
}
</script>
</body>
</html>`;
}

function loginPage(err = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Login · Wanderlust</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-box">
    <h1>✦ Wanderlust</h1>
    <p>Admin Panel — local only</p>
    <form method="POST" action="/login">
      <div class="fg"><label>Email</label>
        <input type="email" name="email" value="${ADMIN_EMAIL}" required autofocus></div>
      <div class="fg"><label>Password</label>
        <input type="password" name="password" required></div>
      <button class="btn btn-outline" style="width:100%" type="submit">Sign In</button>
      ${err ? `<p class="err">${err}</p>` : ''}
    </form>
  </div>
</div>
</body>
</html>`;
}

function dashboardPage(posts, categories) {
  const published = posts.filter(p => p.status === 'published').length;
  const drafts    = posts.filter(p => p.status === 'draft').length;
  const recent = posts.slice(-5).reverse().map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    return `<tr>
      <td><a href="/posts/${p.id}/edit">${escHtml(p.title)}</a></td>
      <td>${cat ? escHtml(cat.name) : '—'}</td>
      <td><span class="badge badge-${p.status==='published'?'pub':'draft'}">${p.status}</span></td>
      <td style="font-size:.8rem;color:var(--muted)">${fmtDate(p.createdAt)}</td>
    </tr>`;
  }).join('');
  return layout('Dashboard', `
<div class="page-header">
  <h1>Dashboard</h1>
  <a href="/posts/new" class="btn">+ New Post</a>
</div>
<div class="stats">
  <div class="stat"><b>${posts.length}</b><small>Total Posts</small></div>
  <div class="stat"><b>${published}</b><small>Published</small></div>
  <div class="stat"><b>${drafts}</b><small>Drafts</small></div>
  <div class="stat"><b>${categories.length}</b><small>Categories</small></div>
</div>
<div class="card">
  <h2 style="font-family:var(--head);font-size:1.1rem;margin-bottom:16px">Recent Posts</h2>
  ${posts.length === 0
    ? '<p style="color:var(--muted);text-align:center;padding:24px">No posts yet. <a href="/posts/new">Create your first one →</a></p>'
    : `<table class="tbl"><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Date</th></tr></thead><tbody>${recent}</tbody></table>`}
</div>
<div class="card" style="margin-top:20px;background:#fffbea;border:1px solid #ffe58f">
  <p style="font-size:.88rem">💡 <strong>Workflow:</strong> Edit posts here → run <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">npm run build</code> in your terminal → commit &amp; push → GitHub Pages updates automatically.</p>
</div>`, 'dash');
}

function postsPage(posts, categories) {
  const rows = posts.slice().reverse().map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    return `<tr>
      <td><a href="/posts/${p.id}/edit">${escHtml(p.title)}</a></td>
      <td>${cat ? escHtml(cat.name) : '—'}</td>
      <td><span class="badge badge-${p.status==='published'?'pub':'draft'}">${p.status}</span></td>
      <td style="font-size:.8rem;color:var(--muted)">${fmtDate(p.updatedAt || p.createdAt)}</td>
      <td>
        <a href="/posts/${p.id}/edit" class="btn-sm">Edit</a>
        <button class="btn-sm btn-danger" onclick="del('${p.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
  return layout('All Posts', `
<div class="page-header">
  <h1>All Posts</h1>
  <a href="/posts/new" class="btn">+ New Post</a>
</div>
<div class="card">
  ${posts.length === 0
    ? '<p style="color:var(--muted);text-align:center;padding:24px">No posts yet. <a href="/posts/new">Create your first one →</a></p>'
    : `<table class="tbl"><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`}
</div>
<script>
async function del(id){
  if(!confirm('Delete this post?')) return;
  const r=await fetch('/api/posts/'+id,{method:'DELETE'});
  if(r.ok){notify('Post deleted');setTimeout(()=>location.reload(),600);}
  else notify('Delete failed','err');
}
</script>`, 'posts');
}

function postFormPage(post, categories, err = '') {
  const isEdit = !!post;
  const catOpts = categories.map(c =>
    `<option value="${c.id}" ${post && post.categoryId===c.id?'selected':''}>${escHtml(c.name)}</option>`
  ).join('');
  return layout(isEdit ? 'Edit Post' : 'New Post', `
<div class="page-header">
  <h1>${isEdit ? 'Edit Post' : 'New Post'}</h1>
  ${isEdit ? `<a href="/posts" class="btn btn-outline">← All Posts</a>` : ''}
</div>
${err ? `<p style="color:#e74c3c;margin-bottom:16px">${err}</p>` : ''}
<form id="pf" class="card" onsubmit="save(event)">
  <input type="hidden" id="pid" value="${isEdit ? post.id : ''}">
  <div class="form-grid">
    <div class="fg span2">
      <label>Title *</label>
      <input type="text" id="pt" value="${isEdit ? escAttr(post.title) : ''}" required placeholder="Your amazing story title…">
    </div>
    <div class="fg">
      <label>Category</label>
      <select id="pcat"><option value="">Select category</option>${catOpts}</select>
    </div>
    <div class="fg">
      <label>Status</label>
      <select id="pst">
        <option value="draft"      ${post&&post.status==='draft'     ?'selected':''}>Draft</option>
        <option value="published"  ${post&&post.status==='published' ?'selected':''}>Published</option>
      </select>
    </div>
    <div class="fg span2">
      <label>Excerpt</label>
      <textarea id="pex" rows="2" placeholder="A brief summary…">${isEdit ? escHtml(post.excerpt||'') : ''}</textarea>
    </div>
    <div class="fg span2">
      <label>Featured Image</label>
      <div class="img-area" id="imgArea">
        ${post&&post.featuredImage ? `<img src="${escAttr(post.featuredImage)}" class="preview" id="prevImg">` : '<p>Click or drag an image here</p>'}
        <input type="file" id="imgInput" accept="image/*" style="display:none">
      </div>
      <input type="hidden" id="imgUrl" value="${isEdit ? escAttr(post.featuredImage||'') : ''}">
    </div>
    <div class="fg span2">
      <label>Content</label>
      <div class="toolbar">
        <button type="button" onclick="ex('bold')"><b>B</b></button>
        <button type="button" onclick="ex('italic')"><i>I</i></button>
        <button type="button" onclick="ex('underline')"><u>U</u></button>
        <span class="toolbar-sep"></span>
        <button type="button" onclick="ex('formatBlock','H2')">H2</button>
        <button type="button" onclick="ex('formatBlock','H3')">H3</button>
        <button type="button" onclick="ex('formatBlock','P')">¶</button>
        <span class="toolbar-sep"></span>
        <button type="button" onclick="ex('insertUnorderedList')">• List</button>
        <button type="button" onclick="ex('insertOrderedList')">1. List</button>
        <button type="button" onclick="ex('formatBlock','BLOCKQUOTE')">Quote</button>
        <span class="toolbar-sep"></span>
        <button type="button" onclick="insLink()">Link</button>
      </div>
      <div id="pc" class="editor" contenteditable="true">${isEdit ? (post.content||'') : ''}</div>
    </div>
    <div class="fg">
      <label>YouTube URL</label>
      <input type="url" id="pyt" value="${isEdit ? escAttr(post.youtubeUrl||'') : ''}" placeholder="https://youtube.com/watch?v=…">
    </div>
    <div class="fg">
      <label>Tags (comma-separated)</label>
      <input type="text" id="ptg" value="${isEdit ? escAttr((post.tags||[]).join(', ')) : ''}" placeholder="travel, adventure, food">
    </div>
  </div>
  <div class="form-actions">
    <button type="submit" class="btn">${isEdit ? 'Update Post' : 'Create Post'}</button>
    <a href="/posts" class="btn btn-outline">Cancel</a>
  </div>
</form>
<script>
function ex(cmd,val=null){document.execCommand(cmd,false,val);document.getElementById('pc').focus();}
function insLink(){const u=prompt('URL:');if(u)document.execCommand('createLink',false,u);}

/* ── Image upload ───────────────────────────────────────────── */
(function(){
  const area=document.getElementById('imgArea');
  const input=document.getElementById('imgInput');
  if(!area||!input)return;
  function setAreaContent(html){
    area.querySelectorAll('img,p').forEach(e=>e.remove());
    const t=document.createElement('div');t.innerHTML=html;
    const fi=area.querySelector('input');
    while(t.firstChild)area.insertBefore(t.firstChild,fi||null);
  }
  area.addEventListener('click',()=>input.click());
  area.addEventListener('dragover',e=>{e.preventDefault();area.style.borderColor='var(--accent)';});
  area.addEventListener('dragleave',()=>{area.style.borderColor='';});
  area.addEventListener('drop',e=>{e.preventDefault();area.style.borderColor='';if(e.dataTransfer.files[0])upload(e.dataTransfer.files[0]);});
  input.addEventListener('change',()=>{if(input.files[0])upload(input.files[0]);});

  async function upload(file){
    try{
      const base64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(',')[1]);
        r.onerror=rej;
        r.readAsDataURL(file);
      });
      setAreaContent('<p>Uploading…</p>');
      const resp=await fetch('/api/upload',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify({filename:file.name,mimeType:file.type,data:base64})
      });
      const j=await resp.json();
      if(j.url){
        document.getElementById('imgUrl').value=j.url;
        setAreaContent('<img src="'+j.url+'" class="preview" id="prevImg">');
        notify('Image uploaded!');
      } else {
        setAreaContent('<p>Upload failed — try again</p>');
        notify(j.error||'Upload failed','err');
      }
    }catch(e){
      setAreaContent('<p>Upload error — try again</p>');
      notify('Upload error: '+e.message,'err');
    }
  }
})();

/* ── Form save ──────────────────────────────────────────────── */
async function save(e){
  e.preventDefault();
  const id=document.getElementById('pid').value;
  const data={
    title:   document.getElementById('pt').value,
    content: document.getElementById('pc').innerHTML,
    excerpt: document.getElementById('pex').value,
    featuredImage: document.getElementById('imgUrl').value,
    youtubeUrl: document.getElementById('pyt').value,
    status:  document.getElementById('pst').value,
    categoryId: document.getElementById('pcat').value,
    tags:    document.getElementById('ptg').value,
  };
  const url=id?'/api/posts/'+id:'/api/posts';
  const method=id?'PUT':'POST';
  try{
    const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(r.ok){
      notify(id?'Post updated!':'Post created!');
      setTimeout(()=>window.location.href='/posts',700);
    } else {
      const err=await r.json();
      notify(err.error||'Save failed','err');
    }
  }catch(err){notify('Network error','err');}
}
</script>`, isEdit ? 'posts' : 'new');
}

function categoriesPage(categories, posts) {
  const rows = categories.map(c => {
    const count = posts.filter(p => p.categoryId === c.id).length;
    return `<tr>
      <td>${escHtml(c.name)}</td>
      <td style="color:var(--muted)">${c.slug}</td>
      <td>${count}</td>
      <td><button class="btn-sm btn-danger" onclick="delCat('${c.id}')">Delete</button></td>
    </tr>`;
  }).join('');
  return layout('Categories', `
<div class="page-header"><h1>Categories</h1></div>
<div class="card" style="margin-bottom:20px">
  <h2 style="font-family:var(--head);font-size:1.1rem;margin-bottom:16px">Add Category</h2>
  <form id="cf" onsubmit="addCat(event)" style="display:flex;gap:10px">
    <input id="cn" type="text" placeholder="Category name" required style="flex:1;padding:10px 13px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--font);font-size:.9rem">
    <button type="submit" class="btn">Add</button>
  </form>
</div>
<div class="card">
  <table class="tbl">
    <thead><tr><th>Name</th><th>Slug</th><th>Posts</th><th>Actions</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No categories yet</td></tr>'}</tbody>
  </table>
</div>
<script>
async function addCat(e){
  e.preventDefault();
  const name=document.getElementById('cn').value;
  const r=await fetch('/api/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
  if(r.ok){notify('Category added');setTimeout(()=>location.reload(),600);}
  else notify('Failed to add','err');
}
async function delCat(id){
  if(!confirm('Delete this category?')) return;
  const r=await fetch('/api/categories/'+id,{method:'DELETE'});
  if(r.ok){notify('Deleted');setTimeout(()=>location.reload(),600);}
  else notify('Failed','err');
}
</script>`, 'cats');
}

// ── Utilities ────────────────────────────────────────────────────
function escHtml(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s='') { return String(s).replace(/"/g,'&quot;'); }
function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}); } catch { return ''; } }

// ══════════════════════════════════════════════════════════════════
//  REQUEST HANDLER
// ══════════════════════════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  try {
    const parsed   = url.parse(req.url, true);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    const method   = req.method;

    // ── Login / logout ──────────────────────────────────────────
    if (pathname === '/login') {
      if (method === 'GET')  return sendHTML(res, loginPage());
      if (method === 'POST') {
        const body = await parseBody(req);
        if (body.email === ADMIN_EMAIL && body.password === ADMIN_PASSWORD) {
          const token = createSession();
          res.writeHead(302, {
            Location: '/',
            'Set-Cookie': `adm=${token}; Path=/; HttpOnly; SameSite=Lax`
          });
          return res.end();
        }
        return sendHTML(res, loginPage('Invalid email or password'));
      }
    }

    if (pathname === '/logout') {
      const cookies = parseCookies(req);
      if (cookies.adm) delete sessions[cookies.adm];
      res.writeHead(302, { Location: '/login', 'Set-Cookie': 'adm=; Path=/; HttpOnly; Max-Age=0' });
      return res.end();
    }

    // ── Auth gate ───────────────────────────────────────────────
    if (!getSession(req)) return redirect(res, '/login');

    const posts      = readDB('posts.json');
    const categories = readDB('categories.json');

    // ── HTML pages ──────────────────────────────────────────────
    if (method === 'GET') {
      if (pathname === '/')
        return sendHTML(res, dashboardPage(posts, categories));
      if (pathname === '/posts')
        return sendHTML(res, postsPage(posts, categories));
      if (pathname === '/posts/new')
        return sendHTML(res, postFormPage(null, categories));
      const editMatch = pathname.match(/^\/posts\/([^/]+)\/edit$/);
      if (editMatch) {
        const post = posts.find(p => p.id === editMatch[1]);
        if (!post) { res.writeHead(404); return res.end('Not found'); }
        return sendHTML(res, postFormPage(post, categories));
      }
      if (pathname === '/categories')
        return sendHTML(res, categoriesPage(categories, posts));
    }

    // ── API ─────────────────────────────────────────────────────
    if (pathname === '/api/posts' && method === 'POST') {
      const body = await parseBody(req);
      const newPost = {
        id: crypto.randomUUID(),
        title: body.title || 'Untitled',
        slug: slugify(body.title || 'untitled'),
        content: body.content || '',
        excerpt: body.excerpt || '',
        featuredImage: body.featuredImage || '',
        youtubeUrl: body.youtubeUrl || '',
        status: body.status || 'draft',
        categoryId: body.categoryId || '',
        tags: body.tags ? body.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // ensure unique slug
      const all = readDB('posts.json');
      let base = newPost.slug, n = 1;
      while (all.find(p => p.slug === newPost.slug)) newPost.slug = `${base}-${n++}`;
      all.push(newPost);
      writeDB('posts.json', all);
      return sendJSON(res, newPost, 201);
    }

    const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch) {
      const id  = postMatch[1];
      const all = readDB('posts.json');
      const idx = all.findIndex(p => p.id === id);

      if (method === 'PUT') {
        if (idx === -1) return sendJSON(res, { error: 'Not found' }, 404);
        const body = await parseBody(req);
        Object.assign(all[idx], {
          title:         body.title         !== undefined ? body.title         : all[idx].title,
          content:       body.content       !== undefined ? body.content       : all[idx].content,
          excerpt:       body.excerpt       !== undefined ? body.excerpt       : all[idx].excerpt,
          featuredImage: body.featuredImage !== undefined ? body.featuredImage : all[idx].featuredImage,
          youtubeUrl:    body.youtubeUrl    !== undefined ? body.youtubeUrl    : all[idx].youtubeUrl,
          status:        body.status        !== undefined ? body.status        : all[idx].status,
          categoryId:    body.categoryId    !== undefined ? body.categoryId    : all[idx].categoryId,
          tags:          body.tags          !== undefined
                           ? body.tags.split(',').map(t=>t.trim()).filter(Boolean)
                           : all[idx].tags,
          updatedAt: new Date().toISOString(),
        });
        writeDB('posts.json', all);
        return sendJSON(res, all[idx]);
      }

      if (method === 'DELETE') {
        if (idx === -1) return sendJSON(res, { error: 'Not found' }, 404);
        all.splice(idx, 1);
        writeDB('posts.json', all);
        return sendJSON(res, { success: true });
      }
    }

    if (pathname === '/api/categories' && method === 'POST') {
      const body = await parseBody(req);
      const cats = readDB('categories.json');
      const cat  = { id: crypto.randomUUID(), name: body.name, slug: slugify(body.name) };
      cats.push(cat);
      writeDB('categories.json', cats);
      return sendJSON(res, cat, 201);
    }

    const catMatch = pathname.match(/^\/api\/categories\/([^/]+)$/);
    if (catMatch && method === 'DELETE') {
      const cats = readDB('categories.json').filter(c => c.id !== catMatch[1]);
      writeDB('categories.json', cats);
      return sendJSON(res, { success: true });
    }

    // ── Image upload ────────────────────────────────────────────
    if (pathname === '/api/upload' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.data) return sendJSON(res, { error: 'No image data' }, 400);
      let ext = path.extname(body.filename || '').toLowerCase();
      if (!ext) {
        const m = { 'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp' };
        ext = m[body.mimeType] || '.jpg';
      }
      const fname = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, fname), Buffer.from(body.data, 'base64'));
      return sendJSON(res, { url: `/uploads/${fname}` });
    }

    // ── Serve uploaded images for preview ───────────────────────
    if (method === 'GET' && pathname.startsWith('/uploads/')) {
      const fp = path.join(UPLOAD_DIR, pathname.slice('/uploads/'.length));
      if (fs.existsSync(fp)) {
        const ext  = path.extname(fp).toLowerCase();
        const mime = { '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp' };
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
        return fs.createReadStream(fp).pipe(res);
      }
    }

    res.writeHead(404); res.end('Not found');
  } catch (err) {
    console.error(err);
    res.writeHead(500); res.end('Server error');
  }
});

server.listen(PORT, () => {
  console.log(`\n  ✦ Wanderlust Admin running at http://localhost:${PORT}`);
  console.log(`  Email: ${ADMIN_EMAIL}  |  Password: ${ADMIN_PASSWORD}`);
  console.log(`\n  After editing: run  node build.js  to generate the static site.\n`);
});
