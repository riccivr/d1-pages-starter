# Svelte Template

A fast, lightweight Svelte 5/Vite template configured for GitHub Pages with Cloudflare Workers + Turso.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your Worker API URL in `.env`:
   ```bash
   VITE_API_URL=https://your-worker-name.your-subdomain.workers.dev
   ```
3. Run dev server:
   ```bash
   npm run dev
   ```
4. Build static distribution:
   ```bash
   npm run build
   ```
   Emits static HTML/CSS/JS to `dist/`.
