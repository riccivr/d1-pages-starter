// Vanilla JS Application Logic
const API_URL = (window.CONFIG && window.CONFIG.API_BASE_URL) || "http://localhost:8787";

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const postForm = document.getElementById("post-form");
const nameInput = document.getElementById("name-input");
const messageInput = document.getElementById("message-input");
const submitBtn = document.getElementById("submit-btn");
const postsContainer = document.getElementById("posts-container");
const errorBox = document.getElementById("error-box");
const messageCounter = document.getElementById("message-counter");

// Update character counter
messageInput.addEventListener("input", () => {
  messageCounter.textContent = `${messageInput.value.length} / 500`;
});

function showError(msg) {
  if (!msg) {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  } else {
    errorBox.style.display = "block";
    errorBox.textContent = msg;
  }
}

function formatRelativeTime(dateString) {
  try {
    const date = new Date(dateString.includes("Z") ? dateString : dateString + "Z");
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

// Check Backend Health
async function checkHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    const data = await res.json();
    if (res.ok && data.status === "online") {
      statusDot.className = "status-dot online";
      statusText.textContent = "Worker & Turso Online";
    } else {
      statusDot.className = "status-dot offline";
      statusText.textContent = `Degraded (${data.error || "DB unreachable"})`;
    }
  } catch (err) {
    statusDot.className = "status-dot offline";
    statusText.textContent = "Backend Offline / CORS Error";
  }
}

// Fetch Posts
async function fetchPosts() {
  try {
    const res = await fetch(`${API_URL}/api/posts?limit=30`);
    if (!res.ok) {
      throw new Error(`Failed to fetch posts: ${res.statusText}`);
    }
    const json = await res.json();
    renderPosts(json.data || []);
  } catch (err) {
    postsContainer.innerHTML = `
      <div class="empty-state">
        <p>⚠️ Unable to load posts from ${API_URL}</p>
        <p style="font-size: 0.8rem; margin-top: 0.5rem; opacity: 0.8;">Make sure your Cloudflare Worker is running and CORS is configured.</p>
      </div>
    `;
  }
}

function renderPosts(posts) {
  if (posts.length === 0) {
    postsContainer.innerHTML = `
      <div class="empty-state">
        <p>No messages yet. Be the first to leave one!</p>
      </div>
    `;
    return;
  }

  postsContainer.innerHTML = posts
    .map(
      (p) => `
    <article class="post-card" data-id="${p.id}">
      <div class="post-meta">
        <span class="post-author">${escapeHtml(p.name)}</span>
        <time class="post-time">${formatRelativeTime(p.created_at)}</time>
      </div>
      <div class="post-body">${escapeHtml(p.message)}</div>
    </article>
  `
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// Submit Post
postForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(null);

  const name = nameInput.value.trim();
  const message = messageInput.value.trim();

  if (!name || !message) {
    showError("Please fill out both your name and a message.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Posting...";

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || "Failed to post message");
    }

    // Reset message, keep name saved in localStorage for convenience
    messageInput.value = "";
    messageCounter.textContent = "0 / 500";
    localStorage.setItem("turso_pages_author", name);

    // Refresh posts
    await fetchPosts();
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign Guestbook";
  }
});

// Restore saved author name
const savedName = localStorage.getItem("turso_pages_author");
if (savedName) {
  nameInput.value = savedName;
}

// Initial Boot
checkHealth();
fetchPosts();
