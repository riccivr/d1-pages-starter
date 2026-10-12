import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export function copyDir(src, dest, transform = null) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      copyDir(srcPath, destPath, transform);
    } else {
      let content = fs.readFileSync(srcPath, "utf-8");
      if (transform) {
        content = transform(content, entry.name, srcPath);
      }
      fs.writeFileSync(destPath, content, "utf-8");
    }
  }
}

export function generateSchema(preset) {
  if (preset === "waitlist") {
    return `-- Waitlist & Lead Capture Schema
CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signups_created_at ON signups (created_at DESC);
`;
  }

  if (preset === "counter") {
    return `-- Counters & Upvotes Schema
CREATE TABLE IF NOT EXISTS counters (
  slug TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  upvotes INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO counters (slug, views, upvotes) VALUES ('home', 1, 0);
`;
  }

  // Default: guestbook
  return `-- Community Guestbook / Posts Schema
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

INSERT INTO posts (name, message) 
VALUES ('Welcome Bot', 'Hello world from your new serverless edge stack!');
`;
}

export function generateWorkerCode({ db, preset }) {
  if (db === "d1") {
    return generateD1WorkerCode(preset);
  } else {
    return generateTursoWorkerCode(preset);
  }
}

function generateD1WorkerCode(preset) {
  return `export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN?: string;
  ADMIN_API_KEY?: string;
}

function getCorsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN || "*";
  const responseOrigin = allowed === "*" ? "*" : (origin.startsWith(allowed) ? origin : allowed);

  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: unknown, status = 200, env: Env, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(env, request),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\\/+$/, "");
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(env, request) });
    }

    try {
      if ((path === "" || path === "/api" || path === "/api/health") && method === "GET") {
        await env.DB.prepare("SELECT 1;").first();
        return jsonResponse({
          status: "online",
          database: "Cloudflare D1",
          timestamp: new Date().toISOString(),
        }, 200, env, request);
      }

      // GET /api/posts
      if (path === "/api/posts" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, name, message, created_at FROM posts ORDER BY created_at DESC LIMIT 50"
        ).all();
        return jsonResponse({ success: true, count: results.length, data: results }, 200, env, request);
      }

      // POST /api/posts
      if (path === "/api/posts" && method === "POST") {
        const body: any = await request.json();
        const name = (body.name || "").trim().slice(0, 50);
        const message = (body.message || "").trim().slice(0, 500);

        if (!name || !message) {
          return jsonResponse({ success: false, error: "Name and message required" }, 400, env, request);
        }

        const newPost = await env.DB.prepare(
          "INSERT INTO posts (name, message) VALUES (?, ?) RETURNING id, name, message, created_at;"
        ).bind(name, message).first();

        return jsonResponse({ success: true, data: newPost }, 201, env, request);
      }

      return jsonResponse({ success: false, error: "Not found: " + path }, 404, env, request);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err.message }, 500, env, request);
    }
  },
};
`;
}

function generateTursoWorkerCode(preset) {
  return `import { createClient } from "@libsql/client/web";

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  ALLOWED_ORIGIN?: string;
  ADMIN_API_KEY?: string;
}

function getCorsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN || "*";
  const responseOrigin = allowed === "*" ? "*" : (origin.startsWith(allowed) ? origin : allowed);

  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: unknown, status = 200, env: Env, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(env, request),
    },
  });
}

function getClient(env: Env) {
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  }
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\\/+$/, "");
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(env, request) });
    }

    try {
      if ((path === "" || path === "/api" || path === "/api/health") && method === "GET") {
        const client = getClient(env);
        await client.execute("SELECT 1;");
        return jsonResponse({
          status: "online",
          database: "Turso (libSQL)",
          timestamp: new Date().toISOString(),
        }, 200, env, request);
      }

      // GET /api/posts
      if (path === "/api/posts" && method === "GET") {
        const client = getClient(env);
        const result = await client.execute("SELECT id, name, message, created_at FROM posts ORDER BY created_at DESC LIMIT 50;");
        return jsonResponse({ success: true, count: result.rows.length, data: result.rows }, 200, env, request);
      }

      // POST /api/posts
      if (path === "/api/posts" && method === "POST") {
        const body: any = await request.json();
        const name = (body.name || "").trim().slice(0, 50);
        const message = (body.message || "").trim().slice(0, 500);

        if (!name || !message) {
          return jsonResponse({ success: false, error: "Name and message required" }, 400, env, request);
        }

        const client = getClient(env);
        const result = await client.execute({
          sql: "INSERT INTO posts (name, message) VALUES (?, ?) RETURNING id, name, message, created_at;",
          args: [name, message],
        });

        return jsonResponse({ success: true, data: result.rows[0] }, 201, env, request);
      }

      return jsonResponse({ success: false, error: "Not found: " + path }, 404, env, request);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err.message }, 500, env, request);
    }
  },
};
`;
}

export function generateTailoredReadme({ projectName, db, frontend, preset, ci }) {
  const dbName = db === "d1" ? "Cloudflare D1 (Native SQLite)" : "Turso (libSQL)";
  const feName = {
    vanilla: "Vanilla HTML/CSS/JS (Zero build)",
    react: "React + Vite + Tailwind CSS",
    astro: "Astro Static SSG",
    svelte: "Svelte 5 + Vite",
  }[frontend];

  return `# ${projectName} ⚡

A 100% free serverless edge web application generated with **create-d1-pages**.

- **Frontend**: ${feName} (hosted on **GitHub Pages**)
- **Edge Gateway**: **Cloudflare Workers** (REST API)
- **Database**: **${dbName}**

---

## 🚀 Quick Setup Guide

### 1. Database Setup
${
  db === "d1"
    ? `Create your Cloudflare D1 database:
\`\`\`bash
npx wrangler login
npx wrangler d1 create ${projectName}-db
\`\`\`
Copy the \`database_id\` printed by Wrangler into \`worker/wrangler.jsonc\`.

Initialize the schema remotely:
\`\`\`bash
npm run db:init:remote
\`\`\`
`
    : `Create your Turso database:
\`\`\`bash
turso db create ${projectName}-db
turso db shell ${projectName}-db < worker/schema.sql
turso db show ${projectName}-db --url
turso db tokens create ${projectName}-db
\`\`\`
Set your secrets:
\`\`\`bash
cd worker
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN
\`\`\`
`
}

### 2. Deploy Edge Worker
\`\`\`bash
cd worker
npm run deploy
\`\`\`
Wrangler will output your live URL (e.g. \`https://${projectName}-api.<user>.workers.dev\`).

### 3. Configure Frontend
${
  frontend === "vanilla"
    ? `Edit \`frontend/config.js\` and set your Worker URL:
\`\`\`javascript
const CONFIG = {
  API_BASE_URL: "https://${projectName}-api.<user>.workers.dev"
};
\`\`\``
    : `Create \`frontend/.env\` and set:
\`\`\`env
${frontend === "astro" ? "PUBLIC_API_URL" : "VITE_API_URL"}=https://${projectName}-api.<user>.workers.dev
\`\`\``
}

### 4. Deploy Frontend to GitHub Pages
${
  ci
    ? `1. Push this repository to GitHub.
2. In GitHub Settings > Pages, set Source to **GitHub Actions**.
3. The included workflow \`.github/workflows/deploy-pages.yml\` will build and deploy automatically!`
    : `Build the frontend (\`npm run build:frontend\`) and host the output on GitHub Pages.`
}

---

## 💻 Local Development

\`\`\`bash
# 1. Start worker
npm run dev:worker

# 2. Start frontend
npm run dev:frontend
\`\`\`
`;
}
