-- Schema for Cloudflare D1 SQLite Database
-- Initialize locally:  npx wrangler d1 execute pages-d1-db --local --file=scripts/setup-db.sql
-- Initialize remotely: npx wrangler d1 execute pages-d1-db --remote --file=scripts/setup-db.sql

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

-- Initial seed row
INSERT INTO posts (name, message) 
VALUES ('Welcome Bot', 'Hello world from Cloudflare D1 + Workers + GitHub Pages!');
