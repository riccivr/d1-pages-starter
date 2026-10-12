-- Schema for the Guestbook / Posts baseline
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for sorting newest first
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
