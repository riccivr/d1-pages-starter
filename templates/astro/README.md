# Astro Template

An Astro static site template configured for GitHub Pages with Cloudflare Workers + Cloudflare D1 SQLite.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your Worker API URL in `.env`:
   ```bash
   PUBLIC_API_URL=https://d1-pages-api.<your-subdomain>.workers.dev
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
