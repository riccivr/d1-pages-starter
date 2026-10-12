<script lang="ts">
  import { onMount } from "svelte";
  import { API_BASE_URL } from "./config";

  interface Post {
    id: number;
    name: string;
    message: string;
    created_at: string;
  }

  let posts: Post[] = [];
  let name: string = "";
  let message: string = "";
  let loading: boolean = true;
  let submitting: boolean = false;
  let status: "checking" | "online" | "offline" = "checking";
  let errorMsg: string | null = null;

  onMount(() => {
    name = localStorage.getItem("turso_svelte_author") || "";
    checkHealth();
    fetchPosts();
  });

  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      const data = await res.json();
      status = res.ok && data.status === "online" ? "online" : "offline";
    } catch {
      status = "offline";
    }
  }

  async function fetchPosts() {
    loading = true;
    try {
      const res = await fetch(`${API_BASE_URL}/api/posts?limit=30`);
      if (!res.ok) throw new Error("Failed to load posts");
      const json = await res.json();
      posts = json.data || [];
      errorMsg = null;
    } catch (err: any) {
      errorMsg = err.message || "Unable to reach API";
    } finally {
      loading = false;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    submitting = true;
    errorMsg = null;

    try {
      const res = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), message: message.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Submission failed");

      localStorage.setItem("turso_svelte_author", name.trim());
      message = "";
      posts = [json.data, ...posts];
    } catch (err: any) {
      errorMsg = err.message;
    } finally {
      submitting = false;
    }
  }

  function formatDate(d: string): string {
    try {
      return new Date(d.includes("Z") ? d : d + "Z").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  }
</script>

<main class="container">
  <header>
    <div class="status-badge">
      <span class="status-indicator {status}"></span>
      <span>{status === 'online' ? 'Cloudflare D1 Connected' : status === 'checking' ? 'Checking DB...' : 'Offline'}</span>
    </div>
    <h1>D1 Pages (Svelte)</h1>
    <p class="subtitle">Reactive frontend on GitHub Pages backed by Cloudflare Worker + Cloudflare D1 SQLite.</p>
  </header>

  <section class="card form-card">
    {#if errorMsg}
      <div class="alert">{errorMsg}</div>
    {/if}

    <form on:submit={handleSubmit}>
      <div class="form-group">
        <label for="name">Your Name</label>
        <input id="name" type="text" bind:value={name} maxlength="50" required placeholder="e.g. Svelte Fan" />
      </div>

      <div class="form-group">
        <div class="label-row">
          <label for="msg">Message</label>
          <span class="counter">{message.length}/500</span>
        </div>
        <textarea id="msg" bind:value={message} maxlength="500" required placeholder="Write something..."></textarea>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? "Saving to D1..." : "Sign Guestbook"}
      </button>
    </form>
  </section>

  <section>
    <div class="feed-header">
      <h2>Entries ({posts.length})</h2>
      <button class="btn-refresh" on:click={fetchPosts} disabled={loading}>
        ↻ Refresh
      </button>
    </div>

    {#if loading && posts.length === 0}
      <p class="empty-state">Loading posts...</p>
    {:else if posts.length === 0}
      <p class="empty-state">No entries yet. Be the first!</p>
    {:else}
      <div class="posts-list">
        {#each posts as post (post.id)}
          <article class="post-card">
            <div class="post-header">
              <span class="post-name">{post.name}</span>
              <span class="post-date">{formatDate(post.created_at)}</span>
            </div>
            <p class="post-body">{post.message}</p>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</main>

<style>
  .container {
    max-width: 680px;
    margin: 0 auto;
    padding: 3rem 1.25rem;
  }
  header {
    text-align: center;
    margin-bottom: 2rem;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    padding: 0.3rem 0.8rem;
    border-radius: 9999px;
    background: rgba(6, 182, 212, 0.1);
    color: var(--accent-cyan);
    border: 1px solid rgba(6, 182, 212, 0.25);
    margin-bottom: 1rem;
  }
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #64748b;
  }
  .status-indicator.online {
    background: var(--accent-cyan);
    box-shadow: 0 0 8px var(--accent-cyan);
  }
  .status-indicator.offline {
    background: var(--accent-red);
  }
  h1 {
    font-size: 2.25rem;
    font-weight: 800;
  }
  .subtitle {
    color: var(--text-muted);
    font-size: 0.95rem;
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  .form-group {
    margin-bottom: 1rem;
  }
  .label-row {
    display: flex;
    justify-content: space-between;
  }
  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
  }
  .counter {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  input, textarea {
    width: 100%;
    background: #090d16;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.75rem;
    color: var(--text-main);
    font-family: inherit;
    font-size: 0.95rem;
  }
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--accent-cyan);
  }
  textarea {
    resize: vertical;
    min-height: 80px;
  }
  button[type="submit"] {
    width: 100%;
    background: linear-gradient(135deg, var(--brand-orange), #ff6b35);
    color: white;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    padding: 0.75rem;
    cursor: pointer;
    font-size: 0.95rem;
  }
  button[type="submit"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .alert {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: var(--accent-red);
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }
  .feed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .btn-refresh {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .btn-refresh:hover {
    color: var(--text-main);
  }
  .posts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .post-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
  }
  .post-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.35rem;
  }
  .post-name {
    font-weight: 700;
    color: var(--accent-cyan);
    font-size: 0.9rem;
  }
  .post-date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .post-body {
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.9rem;
  }
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
</style>
