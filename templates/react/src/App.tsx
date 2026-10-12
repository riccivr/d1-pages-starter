import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "./config";
import { MessageSquare, Send, Database, AlertCircle, RefreshCw } from "lucide-react";

interface Post {
  id: number;
  name: string;
  message: string;
  created_at: string;
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [name, setName] = useState<string>(() => localStorage.getItem("turso_user_name") || "");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<"checking" | "online" | "offline">("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      const data = await res.json();
      if (res.ok && data.status === "online") {
        setDbStatus("online");
      } else {
        setDbStatus("offline");
      }
    } catch {
      setDbStatus("offline");
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/posts?limit=30`);
      if (!res.ok) throw new Error("Failed to load posts");
      const json = await res.json();
      setPosts(json.data || []);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect to edge proxy");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchPosts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), message: message.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to submit post");
      }

      localStorage.setItem("turso_user_name", name.trim());
      setMessage("");
      // Add new post to top
      setPosts((prev) => [json.data, ...prev]);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts.includes("Z") ? ts : ts + "Z");
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <header className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 mb-4">
          <span
            className={`w-2 h-2 rounded-full ${
              dbStatus === "online"
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                : dbStatus === "checking"
                ? "bg-amber-400 animate-pulse"
                : "bg-rose-500"
            }`}
          />
          <Database className="w-3.5 h-3.5" />
          <span>
            {dbStatus === "online"
              ? "Cloudflare D1 + Worker Connected"
              : dbStatus === "checking"
              ? "Checking edge API..."
              : "API / DB Offline"}
          </span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-sky-400 bg-clip-text text-transparent mb-2">
          D1 Pages Starter (React)
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Serverless edge stack: Vite + React on GitHub Pages querying Cloudflare D1 SQLite via Cloudflare Workers.
        </p>
      </header>

      {/* Post Form */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl mb-10 backdrop-blur">
        {errorMessage && (
          <div className="flex items-center gap-2 text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-lg p-3 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                Message
              </label>
              <span className="text-xs text-slate-500">{message.length}/500</span>
            </div>
            <textarea
              required
              maxLength={500}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leave a message in the D1 guestbook..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 to-sky-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg hover:opacity-90 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm shadow-md"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving to D1...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Sign Guestbook</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Feed List */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <span>Community Feed ({posts.length})</span>
          </h2>
          <button
            onClick={fetchPosts}
            title="Refresh feed"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="space-y-3">
          {loading && posts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
              Loading entries...
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm border border-slate-800/80 rounded-xl bg-slate-900/30">
              No entries found yet. Leave the first comment!
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 transition shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sky-400 text-sm">{post.name}</span>
                  <time className="text-xs text-slate-500">{formatTime(post.created_at)}</time>
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{post.message}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
