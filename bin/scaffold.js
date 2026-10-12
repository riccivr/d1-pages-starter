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

export function generateWorkerCode({ db, preset, lang = "typescript" }) {
  if (lang === "rust") {
    return generateRustWorkerCode(preset);
  }
  if (lang === "python") {
    return generatePythonWorkerCode(preset);
  }
  return db === "d1" ? generateD1WorkerCode(preset) : generateTursoWorkerCode(preset);
}

function getD1Routes(preset) {
  if (preset === "waitlist") {
    return `
      // GET /api/signups
      if (path === "/api/signups" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, email, name, created_at FROM signups ORDER BY created_at DESC LIMIT 100"
        ).all();
        return jsonResponse({ success: true, count: results.length, data: results }, 200, env, request);
      }

      // GET /api/signups/count
      if (path === "/api/signups/count" && method === "GET") {
        const row = await env.DB.prepare("SELECT COUNT(*) as count FROM signups").first();
        return jsonResponse({ success: true, count: row?.count ?? 0 }, 200, env, request);
      }

      // POST /api/signups
      if (path === "/api/signups" && method === "POST") {
        const body: any = await request.json();
        const email = (body.email || "").trim().toLowerCase().slice(0, 254);
        const name = (body.name || "").trim().slice(0, 100);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return jsonResponse({ success: false, error: "Valid email required" }, 400, env, request);
        }

        try {
          const newSignup = await env.DB.prepare(
            "INSERT INTO signups (email, name) VALUES (?, ?) RETURNING id, email, name, created_at"
          ).bind(email, name || null).first();
          return jsonResponse({ success: true, data: newSignup }, 201, env, request);
        } catch (e: any) {
          if (e.message?.includes("UNIQUE")) {
            return jsonResponse({ success: false, error: "Email already registered" }, 409, env, request);
          }
          throw e;
        }
      }
`;
  }

  if (preset === "counter") {
    return `
      // GET /api/counters/:slug
      const counterMatch = path.match(/^\/api\/counters\/([a-zA-Z0-9_-]+)$/);
      if (counterMatch && method === "GET") {
        const slug = counterMatch[1];
        let row = await env.DB.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(slug).first();
        if (!row) {
          await env.DB.prepare("INSERT INTO counters (slug, views, upvotes) VALUES (?, 0, 0)").bind(slug).run();
          row = { slug, views: 0, upvotes: 0, updated_at: new Date().toISOString() };
        }
        return jsonResponse({ success: true, data: row }, 200, env, request);
      }

      // POST /api/counters/:slug/view
      const viewMatch = path.match(/^\/api\/counters\/([a-zA-Z0-9_-]+)\/view$/);
      if (viewMatch && method === "POST") {
        const slug = viewMatch[1];
        await env.DB.prepare(
          "INSERT INTO counters (slug, views, upvotes) VALUES (?, 1, 0) ON CONFLICT(slug) DO UPDATE SET views = views + 1, updated_at = CURRENT_TIMESTAMP"
        ).bind(slug).run();
        const row = await env.DB.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(slug).first();
        return jsonResponse({ success: true, data: row }, 200, env, request);
      }

      // POST /api/counters/:slug/upvote
      const upMatch = path.match(/^\/api\/counters\/([a-zA-Z0-9_-]+)\/upvote$/);
      if (upMatch && method === "POST") {
        const slug = upMatch[1];
        await env.DB.prepare(
          "INSERT INTO counters (slug, views, upvotes) VALUES (?, 0, 1) ON CONFLICT(slug) DO UPDATE SET upvotes = upvotes + 1, updated_at = CURRENT_TIMESTAMP"
        ).bind(slug).run();
        const row = await env.DB.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(slug).first();
        return jsonResponse({ success: true, data: row }, 200, env, request);
      }
`;
  }

  // default: guestbook
  return `
      // GET /api/posts
      if (path === "/api/posts" && method === "GET") {
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
        const { results } = await env.DB.prepare(
          "SELECT id, name, message, created_at FROM posts ORDER BY created_at DESC LIMIT ?"
        ).bind(limit).all();
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
          "INSERT INTO posts (name, message) VALUES (?, ?) RETURNING id, name, message, created_at"
        ).bind(name, message).first();

        return jsonResponse({ success: true, data: newPost }, 201, env, request);
      }

      // DELETE /api/posts/:id (admin key optional)
      const delMatch = path.match(/^\/api\/posts\/(\d+)$/);
      if (delMatch && method === "DELETE") {
        if (env.ADMIN_API_KEY) {
          const auth = request.headers.get("Authorization") || "";
          if (auth !== "Bearer " + env.ADMIN_API_KEY) {
            return jsonResponse({ success: false, error: "Unauthorized" }, 401, env, request);
          }
        }
        const id = parseInt(delMatch[1], 10);
        const result = await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, deleted: result.meta?.changes ?? 0 }, 200, env, request);
      }
`;
}

function getTursoRoutes(preset) {
  if (preset === "waitlist") {
    return `
      // GET /api/signups
      if (path === "/api/signups" && method === "GET") {
        const client = getClient(env);
        const result = await client.execute("SELECT id, email, name, created_at FROM signups ORDER BY created_at DESC LIMIT 100");
        return jsonResponse({ success: true, count: result.rows.length, data: result.rows }, 200, env, request);
      }

      // GET /api/signups/count
      if (path === "/api/signups/count" && method === "GET") {
        const client = getClient(env);
        const result = await client.execute("SELECT COUNT(*) as count FROM signups");
        return jsonResponse({ success: true, count: result.rows[0]?.count ?? 0 }, 200, env, request);
      }

      // POST /api/signups
      if (path === "/api/signups" && method === "POST") {
        const body: any = await request.json();
        const email = (body.email || "").trim().toLowerCase().slice(0, 254);
        const name = (body.name || "").trim().slice(0, 100);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return jsonResponse({ success: false, error: "Valid email required" }, 400, env, request);
        }

        const client = getClient(env);
        try {
          const result = await client.execute({
            sql: "INSERT INTO signups (email, name) VALUES (?, ?) RETURNING id, email, name, created_at",
            args: [email, name || null],
          });
          return jsonResponse({ success: true, data: result.rows[0] }, 201, env, request);
        } catch (e: any) {
          if (e.message?.includes("UNIQUE") || e.message?.includes("unique")) {
            return jsonResponse({ success: false, error: "Email already registered" }, 409, env, request);
          }
          throw e;
        }
      }
`;
  }

  if (preset === "counter") {
    return `
      // GET /api/counters/:slug
      const counterMatch = path.match(/^\/api\/counters\/([a-zA-Z0-9_-]+)$/);
      if (counterMatch && method === "GET") {
        const slug = counterMatch[1];
        const client = getClient(env);
        let result = await client.execute({ sql: "SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?", args: [slug] });
        if (result.rows.length === 0) {
          await client.execute({ sql: "INSERT INTO counters (slug, views, upvotes) VALUES (?, 0, 0)", args: [slug] });
          result = await client.execute({ sql: "SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?", args: [slug] });
        }
        return jsonResponse({ success: true, data: result.rows[0] }, 200, env, request);
      }

      // POST /api/counters/:slug/view
      const viewMatch = path.match(/^\/api\/counters\/([a-zA-Z0-9_-]+)\/view$/);
      if (viewMatch && method === "POST") {
        const slug = viewMatch[1];
        const client = getClient(env);
        await client.execute({
          sql: "INSERT INTO counters (slug, views, upvotes) VALUES (?, 1, 0) ON CONFLICT(slug) DO UPDATE SET views = views + 1, updated_at = CURRENT_TIMESTAMP",
          args: [slug],
        });
        const result = await client.execute({ sql: "SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?", args: [slug] });
        return jsonResponse({ success: true, data: result.rows[0] }, 200, env, request);
      }

      // POST /api/counters/:slug/upvote
      const upMatch = path.match(/^\/api\/counters\/([a-zA-Z0-9_-]+)\/upvote$/);
      if (upMatch && method === "POST") {
        const slug = upMatch[1];
        const client = getClient(env);
        await client.execute({
          sql: "INSERT INTO counters (slug, views, upvotes) VALUES (?, 0, 1) ON CONFLICT(slug) DO UPDATE SET upvotes = upvotes + 1, updated_at = CURRENT_TIMESTAMP",
          args: [slug],
        });
        const result = await client.execute({ sql: "SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?", args: [slug] });
        return jsonResponse({ success: true, data: result.rows[0] }, 200, env, request);
      }
`;
  }

  // default guestbook
  return `
      // GET /api/posts
      if (path === "/api/posts" && method === "GET") {
        const client = getClient(env);
        const result = await client.execute("SELECT id, name, message, created_at FROM posts ORDER BY created_at DESC LIMIT 50");
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
          sql: "INSERT INTO posts (name, message) VALUES (?, ?) RETURNING id, name, message, created_at",
          args: [name, message],
        });

        return jsonResponse({ success: true, data: result.rows[0] }, 201, env, request);
      }
`;
}

function generateD1WorkerCode(preset) {
  const routes = getD1Routes(preset);
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
          runtime: "TypeScript",
          preset: "${preset || "guestbook"}",
          timestamp: new Date().toISOString(),
        }, 200, env, request);
      }
${routes}
      return jsonResponse({ success: false, error: "Not found: " + path }, 404, env, request);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err.message }, 500, env, request);
    }
  },
};
`;
}

function generateTursoWorkerCode(preset) {
  const routes = getTursoRoutes(preset);
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
          runtime: "TypeScript",
          preset: "${preset || "guestbook"}",
          timestamp: new Date().toISOString(),
        }, 200, env, request);
      }
${routes}
      return jsonResponse({ success: false, error: "Not found: " + path }, 404, env, request);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err.message }, 500, env, request);
    }
  },
};
`;
}

export function generateRustCargoToml(projectName) {
  return `[package]
name = "${projectName}-worker"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
worker = { version = "0.4.2", features = ["d1"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
opt-level = "s"
lto = true
codegen-units = 1
`;
}

export function generateRustWorkerCode(preset) {
  // Preset-aware Rust worker (D1 only for now)
  const routes = preset === "waitlist" ? `
        (Method::Get, "/api/signups") => {
            let d1 = env.d1("DB")?;
            let stmt = d1.prepare("SELECT id, email, name, created_at FROM signups ORDER BY created_at DESC LIMIT 100");
            let results = stmt.all().await?.results::<serde_json::Value>()?;
            Response::from_json(&serde_json::json!({
                "success": true,
                "count": results.len(),
                "data": results
            }))
        }
        (Method::Post, "/api/signups") => {
            let mut req = req;
            let body: serde_json::Value = req.json().await?;
            let email = body.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
            let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();

            if email.is_empty() || !email.contains('@') || !email.contains('.') {
                return cors_response(
                    Response::from_json(&serde_json::json!({"success": false, "error": "Valid email required"}))?.with_status(400),
                    &allowed_origin,
                );
            }

            let d1 = env.d1("DB")?;
            let stmt = d1.prepare("INSERT INTO signups (email, name) VALUES (?, ?) RETURNING id, email, name, created_at")
                .bind(&[email.into(), name.into()])?;
            let row: serde_json::Value = stmt.first(None).await?.unwrap_or_default();
            Response::from_json(&serde_json::json!({"success": true, "data": row}))
        }
` : preset === "counter" ? `
        (Method::Get, path) if path.starts_with("/api/counters/") && !path.contains("/view") && !path.contains("/upvote") => {
            let slug = path.trim_start_matches("/api/counters/");
            let d1 = env.d1("DB")?;
            let stmt = d1.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(&[slug.into()])?;
            let row: Option<serde_json::Value> = stmt.first(None).await?;
            let data = row.unwrap_or_else(|| serde_json::json!({"slug": slug, "views": 0, "upvotes": 0}));
            Response::from_json(&serde_json::json!({"success": true, "data": data}))
        }
        (Method::Post, path) if path.ends_with("/view") && path.starts_with("/api/counters/") => {
            let slug = path.trim_start_matches("/api/counters/").trim_end_matches("/view");
            let d1 = env.d1("DB")?;
            let stmt = d1.prepare(
                "INSERT INTO counters (slug, views, upvotes) VALUES (?, 1, 0) ON CONFLICT(slug) DO UPDATE SET views = views + 1, updated_at = CURRENT_TIMESTAMP"
            ).bind(&[slug.into()])?;
            stmt.run().await?;
            let row: serde_json::Value = d1.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(&[slug.into()])?.first(None).await?.unwrap_or_default();
            Response::from_json(&serde_json::json!({"success": true, "data": row}))
        }
        (Method::Post, path) if path.ends_with("/upvote") && path.starts_with("/api/counters/") => {
            let slug = path.trim_start_matches("/api/counters/").trim_end_matches("/upvote");
            let d1 = env.d1("DB")?;
            let stmt = d1.prepare(
                "INSERT INTO counters (slug, views, upvotes) VALUES (?, 0, 1) ON CONFLICT(slug) DO UPDATE SET upvotes = upvotes + 1, updated_at = CURRENT_TIMESTAMP"
            ).bind(&[slug.into()])?;
            stmt.run().await?;
            let row: serde_json::Value = d1.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(&[slug.into()])?.first(None).await?.unwrap_or_default();
            Response::from_json(&serde_json::json!({"success": true, "data": row}))
        }
` : `
        (Method::Get, "/api/posts") => {
            let d1 = env.d1("DB")?;
            let stmt = d1.prepare("SELECT id, name, message, created_at FROM posts ORDER BY created_at DESC LIMIT 50");
            let results = stmt.all().await?.results::<serde_json::Value>()?;
            Response::from_json(&serde_json::json!({
                "success": true,
                "count": results.len(),
                "data": results
            }))
        }
        (Method::Post, "/api/posts") => {
            let mut req = req;
            let body: serde_json::Value = req.json().await?;
            let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            let message = body.get("message").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();

            if name.is_empty() || message.is_empty() {
                return cors_response(
                    Response::from_json(&serde_json::json!({"success": false, "error": "Name and message required"}))?.with_status(400),
                    &allowed_origin,
                );
            }

            let d1 = env.d1("DB")?;
            let stmt = d1.prepare("INSERT INTO posts (name, message) VALUES (?, ?) RETURNING id, name, message, created_at")
                .bind(&[name.into(), message.into()])?;
            let post: serde_json::Value = stmt.first(None).await?.unwrap_or_default();
            Response::from_json(&serde_json::json!({"success": true, "data": post}))
        }
`;

  return `use worker::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

fn cors_response(res: Response, allowed: &str) -> Result<Response> {
    let mut headers = res.headers().clone();
    headers.set("Access-Control-Allow-Origin", allowed)?;
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")?;
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")?;
    Ok(res.with_headers(headers))
}

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let method = req.method();
    let allowed_origin = env
        .var("ALLOWED_ORIGIN")
        .map(|v| v.to_string())
        .unwrap_or_else(|_| "*".to_string());

    if method == Method::Options {
        let res = Response::empty()?.with_status(204);
        return cors_response(res, &allowed_origin);
    }

    let path = req.path();
    let response = match (method, path.as_str()) {
        (Method::Get, "" | "/api" | "/api/health") => {
            let d1 = env.d1("DB")?;
            d1.prepare("SELECT 1;").first::<Value>(None).await?;
            Response::from_json(&serde_json::json!({
                "status": "online",
                "database": "Cloudflare D1",
                "runtime": "Rust (WebAssembly / worker-rs)",
                "preset": "${preset || "guestbook"}"
            }))
        }
${routes}
        _ => Response::from_json(&serde_json::json!({
            "success": false,
            "error": format!("Route not found: {}", path)
        }))?
        .with_status(404),
    };

    match response {
        Ok(res) => cors_response(res, &allowed_origin),
        Err(e) => cors_response(
            Response::from_json(&serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))?
            .with_status(500),
            &allowed_origin,
        ),
    }
}
`;
}

export function generatePythonWorkerCode(preset) {
  const routes = preset === "waitlist" ? `
        if pathname == "/api/signups" and method == "GET":
            result = await env.DB.prepare("SELECT id, email, name, created_at FROM signups ORDER BY created_at DESC LIMIT 100").all()
            data = {"success": True, "count": len(result.results), "data": result.results}
            return Response.new(json.dumps(data), status=200, headers=headers)

        if pathname == "/api/signups/count" and method == "GET":
            row = await env.DB.prepare("SELECT COUNT(*) as count FROM signups").first()
            count = row.count if row else 0
            return Response.new(json.dumps({"success": True, "count": count}), status=200, headers=headers)

        if pathname == "/api/signups" and method == "POST":
            req_json = await request.json()
            email = str(req_json.email or "").strip().lower()[:254]
            name = str(req_json.name or "").strip()[:100]
            if not email or "@" not in email or "." not in email:
                return Response.new(json.dumps({"success": False, "error": "Valid email required"}), status=400, headers=headers)
            try:
                row = await env.DB.prepare(
                    "INSERT INTO signups (email, name) VALUES (?, ?) RETURNING id, email, name, created_at"
                ).bind(email, name or None).first()
                return Response.new(json.dumps({"success": True, "data": row}), status=201, headers=headers)
            except Exception as e:
                if "UNIQUE" in str(e).upper():
                    return Response.new(json.dumps({"success": False, "error": "Email already registered"}), status=409, headers=headers)
                raise
` : preset === "counter" ? `
        if pathname.startswith("/api/counters/") and method == "GET" and "/" not in pathname[len("/api/counters/"):]:
            slug = pathname[len("/api/counters/"):]
            row = await env.DB.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(slug).first()
            if not row:
                await env.DB.prepare("INSERT INTO counters (slug, views, upvotes) VALUES (?, 0, 0)").bind(slug).run()
                row = {"slug": slug, "views": 0, "upvotes": 0}
            return Response.new(json.dumps({"success": True, "data": row}), status=200, headers=headers)

        if pathname.endswith("/view") and pathname.startswith("/api/counters/") and method == "POST":
            slug = pathname[len("/api/counters/"):-len("/view")]
            await env.DB.prepare(
                "INSERT INTO counters (slug, views, upvotes) VALUES (?, 1, 0) ON CONFLICT(slug) DO UPDATE SET views = views + 1, updated_at = CURRENT_TIMESTAMP"
            ).bind(slug).run()
            row = await env.DB.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(slug).first()
            return Response.new(json.dumps({"success": True, "data": row}), status=200, headers=headers)

        if pathname.endswith("/upvote") and pathname.startswith("/api/counters/") and method == "POST":
            slug = pathname[len("/api/counters/"):-len("/upvote")]
            await env.DB.prepare(
                "INSERT INTO counters (slug, views, upvotes) VALUES (?, 0, 1) ON CONFLICT(slug) DO UPDATE SET upvotes = upvotes + 1, updated_at = CURRENT_TIMESTAMP"
            ).bind(slug).run()
            row = await env.DB.prepare("SELECT slug, views, upvotes, updated_at FROM counters WHERE slug = ?").bind(slug).first()
            return Response.new(json.dumps({"success": True, "data": row}), status=200, headers=headers)
` : `
        if pathname == "/api/posts" and method == "GET":
            result = await env.DB.prepare("SELECT id, name, message, created_at FROM posts ORDER BY created_at DESC LIMIT 50").all()
            data = {"success": True, "count": len(result.results), "data": result.results}
            return Response.new(json.dumps(data), status=200, headers=headers)

        if pathname == "/api/posts" and method == "POST":
            req_json = await request.json()
            name = str(req_json.name or "").strip()[:50]
            msg = str(req_json.message or "").strip()[:500]
            if not name or not msg:
                return Response.new(json.dumps({"success": False, "error": "Name and message required"}), status=400, headers=headers)
            post = await env.DB.prepare(
                "INSERT INTO posts (name, message) VALUES (?, ?) RETURNING id, name, message, created_at"
            ).bind(name, msg).first()
            return Response.new(json.dumps({"success": True, "data": post}), status=201, headers=headers)
`;

  return `from js import Response, Headers
import json

def get_cors_headers(env):
    try:
        allowed = env.ALLOWED_ORIGIN or "*"
    except Exception:
        allowed = "*"
    headers = Headers.new()
    headers.set("Access-Control-Allow-Origin", allowed)
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    headers.set("Content-Type", "application/json")
    return headers

async def on_fetch(request, env):
    method = request.method
    headers = get_cors_headers(env)

    if method == "OPTIONS":
        return Response.new(None, status=204, headers=headers)

    url_str = str(request.url)
    path = url_str.split("?")[0].replace("http://", "").replace("https://", "")
    parts = path.split("/")[1:]
    pathname = "/" + "/".join(parts) if parts else "/"
    pathname = pathname.rstrip("/")

    try:
        if pathname in ["", "/api", "/api/health"] and method == "GET":
            await env.DB.prepare("SELECT 1;").first()
            data = {"status": "online", "database": "Cloudflare D1", "runtime": "Python", "preset": "${preset || "guestbook"}"}
            return Response.new(json.dumps(data), status=200, headers=headers)

${routes}
        return Response.new(json.dumps({"success": False, "error": f"Route not found: {pathname}"}), status=404, headers=headers)
    except Exception as e:
        return Response.new(json.dumps({"success": False, "error": str(e)}), status=500, headers=headers)
`;
}

export function generateTailoredReadme({ projectName, db, frontend, backendLang = "typescript", preset, ci }) {
  const dbName = db === "d1" ? "Cloudflare D1 (Native SQLite)" : "Turso (libSQL)";
  const feName = {
    vanilla: "Vanilla HTML/CSS/JS (Zero build)",
    react: "React + Vite + Tailwind CSS",
    astro: "Astro Static SSG",
    svelte: "Svelte 5 + Vite",
  }[frontend];

  const beName = {
    typescript: "TypeScript (V8 Cloudflare Worker)",
    rust: "Rust (worker-rs compiled to WebAssembly)",
    python: "Python (Pyodide on Cloudflare Workers)",
  }[backendLang] || "TypeScript";

  const presetApi = {
    guestbook: `
### Guestbook API
- \`GET /api/posts?limit=N\` — list recent posts
- \`POST /api/posts\` — create post \`{ name, message }\`
- \`DELETE /api/posts/:id\` — delete (requires \`ADMIN_API_KEY\` if set)
`,
    waitlist: `
### Waitlist API
- \`GET /api/signups\` — list recent signups
- \`GET /api/signups/count\` — total count
- \`POST /api/signups\` — register \`{ email, name? }\` (email uniqueness enforced)
`,
    counter: `
### Counters API
- \`GET /api/counters/:slug\` — get current views + upvotes
- \`POST /api/counters/:slug/view\` — atomic view increment
- \`POST /api/counters/:slug/upvote\` — atomic upvote increment
`,
  }[preset] || "";

  const frontendNote = preset !== "guestbook"
    ? `
> **Note:** The included frontend templates are currently oriented toward the Guestbook preset.
> For Waitlist or Counters you will need to adapt the frontend to call the endpoints above.
`
    : "";

  const tursoNote = (db === "turso" && backendLang !== "typescript")
    ? `
> **Note:** Turso support is currently only fully implemented for the TypeScript worker.
> Rust and Python generators use Cloudflare D1. Consider switching to TypeScript if you need Turso.
`
    : "";

  return `# ${projectName}

Serverless edge web application generated with create-d1-pages.

* Frontend: ${feName} (hosted on GitHub Pages)
* Backend: ${beName} on Cloudflare Workers
* Database: ${dbName}
* Preset: ${preset || "guestbook"}

${frontendNote}${tursoNote}

---

## Setup

### 1. Database setup
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
cd worker && npm run db:init:remote
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

### 2. Deploy edge worker (${backendLang.toUpperCase()})
${
  backendLang === "rust"
    ? `For Rust workers, ensure Rust and the wasm target are installed:
\`\`\`bash
rustup target add wasm32-unknown-unknown
cargo install -q worker-build
cd worker
npm run deploy
\`\`\``
    : `\`\`\`bash
cd worker
npm run deploy
\`\`\``
}

Wrangler prints your live endpoint URL (e.g. \`https://${projectName}-api.<user>.workers.dev\`).

### 3. Configure frontend
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

${presetApi}

### 4. Local development
\`\`\`bash
cd worker && npm run db:init:local && npm run dev
# then in another terminal start the frontend dev server
\`\`\`

---

Generated with [d1-pages-starter](https://github.com/riccivr/d1-pages-starter).
`;
}
