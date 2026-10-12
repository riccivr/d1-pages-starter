import { createClient, type Client } from "@libsql/client/web";

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  ALLOWED_ORIGIN?: string;
  ADMIN_API_KEY?: string;
}

interface PostInput {
  name?: string;
  message?: string;
}

function getCorsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN || "*";

  // If configured as "*", allow any origin
  // If specific origin configured, match or default to allowed
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

function getTursoClient(env: Env): Client {
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in Worker environment");
  }

  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, ""); // normalize trailing slash
    const method = request.method;

    // Handle CORS preflight requests
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(env, request),
      });
    }

    try {
      // Health / Status endpoint
      if ((path === "" || path === "/api" || path === "/api/health") && method === "GET") {
        try {
          const client = getTursoClient(env);
          await client.execute("SELECT 1;");
          return jsonResponse({
            status: "online",
            database: "connected",
            timestamp: new Date().toISOString(),
          }, 200, env, request);
        } catch (dbErr: any) {
          return jsonResponse({
            status: "degraded",
            database: "unreachable",
            error: dbErr.message,
          }, 503, env, request);
        }
      }

      // GET /api/posts - Fetch latest posts
      if (path === "/api/posts" && method === "GET") {
        const client = getTursoClient(env);
        const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
        const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 100);

        const result = await client.execute({
          sql: "SELECT id, name, message, created_at FROM posts ORDER BY created_at DESC LIMIT ?",
          args: [limit],
        });

        const posts = result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          message: row.message,
          created_at: row.created_at,
        }));

        return jsonResponse({ success: true, count: posts.length, data: posts }, 200, env, request);
      }

      // POST /api/posts - Create a new post
      if (path === "/api/posts" && method === "POST") {
        let body: PostInput;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ success: false, error: "Invalid JSON payload" }, 400, env, request);
        }

        const name = (body.name || "").trim();
        const message = (body.message || "").trim();

        if (!name || name.length > 50) {
          return jsonResponse(
            { success: false, error: "Name is required and must be 1 to 50 characters" },
            400,
            env,
            request
          );
        }

        if (!message || message.length > 500) {
          return jsonResponse(
            { success: false, error: "Message is required and must be 1 to 500 characters" },
            400,
            env,
            request
          );
        }

        const client = getTursoClient(env);
        const result = await client.execute({
          sql: "INSERT INTO posts (name, message) VALUES (?, ?) RETURNING id, name, message, created_at;",
          args: [name, message],
        });

        const newPost = result.rows[0];

        return jsonResponse(
          {
            success: true,
            data: {
              id: newPost.id,
              name: newPost.name,
              message: newPost.message,
              created_at: newPost.created_at,
            },
          },
          201,
          env,
          request
        );
      }

      // DELETE /api/posts/:id - Delete a post
      const deleteMatch = path.match(/^\/api\/posts\/(\d+)$/);
      if (deleteMatch && method === "DELETE") {
        // If ADMIN_API_KEY is configured, enforce authorization
        if (env.ADMIN_API_KEY) {
          const authHeader = request.headers.get("Authorization") || "";
          const expected = `Bearer ${env.ADMIN_API_KEY}`;
          if (authHeader !== expected) {
            return jsonResponse({ success: false, error: "Unauthorized" }, 401, env, request);
          }
        }

        const postId = parseInt(deleteMatch[1], 10);
        const client = getTursoClient(env);
        const result = await client.execute({
          sql: "DELETE FROM posts WHERE id = ?",
          args: [postId],
        });

        return jsonResponse(
          { success: true, deleted: result.rowsAffected > 0, id: postId },
          200,
          env,
          request
        );
      }

      // 404 Route Not Found
      return jsonResponse(
        { success: false, error: `Endpoint not found: ${method} ${path}` },
        404,
        env,
        request
      );
    } catch (err: any) {
      console.error("Worker unhandled error:", err);
      return jsonResponse(
        { success: false, error: err.message || "Internal server error" },
        500,
        env,
        request
      );
    }
  },
};
