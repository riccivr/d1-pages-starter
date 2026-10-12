# React + Vite Template

A modern React 18/19 template using Vite, TypeScript, and Tailwind CSS configured for GitHub Pages and Cloudflare Workers + Turso.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment file:
   ```bash
   cp .env.example .env
   ```
   Set `VITE_API_URL` to your Cloudflare Worker URL (or leave blank to default to `http://localhost:8787`).
3. Run local dev server:
   ```bash
   npm run dev
   ```
4. Build for GitHub Pages:
   ```bash
   npm run build
   ```
   The static bundle is emitted to `dist/`.
