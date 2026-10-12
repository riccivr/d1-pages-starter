-- Database initialization script for Turso
-- Run this using:
--   turso db shell <your-db-name> < scripts/setup-db.sql
-- Or using npm run db:setup (if node environment has credentials in .env)

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

-- Optional initial seed row
INSERT INTO posts (name, message) 
VALUES ('Welcome Bot', 'Hello world from Turso + Cloudflare Workers + GitHub Pages!');
