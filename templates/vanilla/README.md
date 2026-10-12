# Vanilla JS Template

A zero-build, dependency-free frontend template for GitHub Pages connecting to your Cloudflare Worker & Turso backend.

## Features
- **Zero build step**: No Node/npm required to view or deploy.
- **Instant preview**: Open `index.html` directly in any web browser.
- **Responsive & Dark Mode**: Handcrafted CSS with modern styling and responsive layout.
- **Configurable**: Easily set your Cloudflare Worker endpoint in `config.js`.

## How to Configure
Edit `config.js`:
```javascript
const CONFIG = {
  API_BASE_URL: "https://your-worker.your-subdomain.workers.dev",
};
```

## How to Deploy to GitHub Pages
1. Push this directory to your repository root or `docs/` folder, or use the `.github/workflows/deploy-pages.yml` GitHub Action.
2. Under your GitHub Repository **Settings** > **Pages**, set Source to **GitHub Actions** (or Deploy from a branch -> `/templates/vanilla` or `/docs`).
