# Wanderlust Chronicles — Static Site

A fully static travel blog deployable to **GitHub Pages**, with a **local admin panel** for managing posts without any third-party CMS.

---

## How it works

```
Local machine                          GitHub Pages
─────────────────────────────────      ──────────────────────
node admin-server.js  ←→  data/       docs/index.html
     ↓ edit posts               →     docs/blog/…
node build.js         →  docs/        docs/about/
     ↓ git push                        (live site)
```

- **`data/posts.json`** and **`data/categories.json`** are the source of truth.
- **`docs/`** is the generated static site — this is what GitHub Pages serves.
- Images you upload are saved to **`docs/uploads/`** and committed with the rest of the site.

---

## Quick start

### 1. Install (no dependencies needed — pure Node.js)
```bash
node --version   # must be 18+
```

### 2. Run the admin panel
```bash
node admin-server.js
# open http://localhost:3001
# Email: admin@wanderlust.com  |  Password: admin123
```

Change the credentials at the top of `admin-server.js`:
```js
const ADMIN_EMAIL    = 'your@email.com';
const ADMIN_PASSWORD = 'your-password';
```

### 3. Build the static site
```bash
node build.js
# or
npm run build
```
This generates / overwrites the HTML files in `docs/`.

### 4. Preview locally (optional)
Any static file server works:
```bash
npx serve docs
# or
python3 -m http.server 8080 --directory docs
```

---

## Deploy to GitHub Pages

### First time setup
1. Create a new GitHub repo (e.g. `my-travel-blog`)
2. Push this folder to the repo
3. Go to **Settings → Pages**
4. Set **Source** to: `Deploy from a branch`
5. Set **Branch** to: `main` and **Folder** to: `/docs`
6. Save — your site will be live at `https://YOUR-USERNAME.github.io/my-travel-blog/`

### Every time you publish new content
```bash
node build.js          # regenerate docs/
git add .
git commit -m "Add new post: My Trip to..."
git push
```
GitHub Pages rebuilds automatically within ~30 seconds.

---

## Admin panel features

| Feature | Details |
|---|---|
| **Posts** | Create, edit, delete with rich text editor |
| **Images** | Upload from your computer → saved to `docs/uploads/` |
| **Categories** | Add / remove categories |
| **Status** | Draft (hidden) or Published (visible on site) |
| **YouTube** | Paste a YouTube URL — embedded automatically |
| **Tags** | Comma-separated, shown on post pages |

---

## File structure

```
travel-blog-static/
├── data/
│   ├── posts.json          ← all post content
│   └── categories.json     ← categories
├── docs/                   ← generated static site (committed to git)
│   ├── index.html
│   ├── blog/
│   │   ├── index.html
│   │   └── my-post-slug/
│   │       └── index.html
│   ├── about/
│   │   └── index.html
│   ├── css/
│   │   └── style.css
│   └── uploads/            ← images (committed to git)
├── admin-server.js         ← local admin (never deployed)
├── build.js                ← static site generator
└── package.json
```

---

## Customising the About page

Edit the `buildAbout()` function in `build.js` — replace the placeholder text and add your photo to `docs/uploads/about-photo.jpg`.

## Custom domain

1. Add a `CNAME` file to `docs/` containing your domain: `blog.yourdomain.com`
2. Configure your DNS to point to GitHub Pages
3. Enable HTTPS in GitHub Pages settings

---

## Tips

- **Draft posts** are saved in `data/posts.json` but not included in the build output — safe to have works-in-progress.
- **No build step needed for CSS or JS changes** — edit `docs/css/style.css` directly and commit.
- **Image paths**: the admin saves images as `/uploads/filename.jpg`. These paths work correctly on GitHub Pages when the repo is served from root. If you use a project repo (`username.github.io/repo-name/`), update the `url` returned by `/api/upload` in `admin-server.js` to include the sub-path prefix.
