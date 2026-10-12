// Preset-aware frontend overrides.
// Returns the main app file content for non-guestbook presets, or null for guestbook.

export function generateFrontendOverride(frontend, preset) {
  if (!preset || preset === "guestbook") return null;

  const map = {
    vanilla: { waitlist: VANILLA_WAITLIST, counter: VANILLA_COUNTER },
    react: { waitlist: REACT_WAITLIST, counter: REACT_COUNTER },
    svelte: { waitlist: SVELTE_WAITLIST, counter: SVELTE_COUNTER },
    astro: { waitlist: ASTRO_WAITLIST, counter: ASTRO_COUNTER },
  };

  return map[frontend]?.[preset] || null;
}

const VANILLA_WAITLIST = `// Vanilla — Waitlist
const API_URL = (window.CONFIG && window.CONFIG.API_BASE_URL) || "http://localhost:8787";
const form = document.getElementById("post-form");
const emailInput = document.getElementById("name-input");
const nameInput = document.getElementById("message-input");
const submitBtn = document.getElementById("submit-btn");
const list = document.getElementById("posts-container");
const errorBox = document.getElementById("error-box");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const countEl = document.getElementById("message-counter");

function showError(msg) {
  errorBox.style.display = msg ? "block" : "none";
  errorBox.textContent = msg || "";
}
function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }

async function health() {
  try {
    const r = await fetch(API_URL + "/api/health");
    const d = await r.json();
    statusDot.className = r.ok && d.status === "online" ? "status-dot online" : "status-dot offline";
    statusText.textContent = r.ok && d.status === "online" ? "Online" : "Offline";
  } catch { statusDot.className = "status-dot offline"; statusText.textContent = "Offline"; }
}

async function load() {
  try {
    const [a, b] = await Promise.all([fetch(API_URL + "/api/signups"), fetch(API_URL + "/api/signups/count")]);
    const listData = await a.json();
    const countData = await b.json();
    if (countEl) countEl.textContent = (countData.count || 0) + " signups";
    const items = listData.data || [];
    list.innerHTML = items.length
      ? items.map(s => '<article class="post-card"><div class="post-meta"><span class="post-author">' + esc(s.email) + '</span></div></article>').join("")
      : '<div class="empty-state"><p>No signups yet</p></div>';
  } catch { list.innerHTML = '<div class="empty-state"><p>Failed to load</p></div>'; }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const name = nameInput.value.trim();
  if (!email.includes("@")) { showError("Valid email required"); return; }
  submitBtn.disabled = true; submitBtn.textContent = "Joining...";
  try {
    const res = await fetch(API_URL + "/api/signups", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email, name }) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Failed");
    emailInput.value = ""; nameInput.value = "";
    await load();
  } catch (err) { showError(err.message); }
  finally { submitBtn.disabled = false; submitBtn.textContent = "Join Waitlist"; }
});

health(); load();
`;

const VANILLA_COUNTER = `// Vanilla — Counters
const API_URL = (window.CONFIG && window.CONFIG.API_BASE_URL) || "http://localhost:8787";
const list = document.getElementById("posts-container");
const form = document.getElementById("post-form");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
if (form) form.style.display = "none";

async function health() {
  try {
    const r = await fetch(API_URL + "/api/health");
    const d = await r.json();
    statusDot.className = r.ok && d.status === "online" ? "status-dot online" : "status-dot offline";
    statusText.textContent = r.ok && d.status === "online" ? "Online" : "Offline";
  } catch { statusDot.className = "status-dot offline"; }
}

async function load() {
  const res = await fetch(API_URL + "/api/counters/home");
  const json = await res.json();
  const d = json.data || { views: 0, upvotes: 0 };
  list.innerHTML = '<div class="post-card" style="text-align:center;padding:2rem"><h2>' + (d.views||0) + ' views</h2><h2>' + (d.upvotes||0) + ' upvotes</h2><button id="up">Upvote</button> <button id="view">+1 View</button></div>';
  document.getElementById("up").onclick = () => bump("upvote");
  document.getElementById("view").onclick = () => bump("view");
}

async function bump(a) {
  await fetch(API_URL + "/api/counters/home/" + a, { method: "POST" });
  load();
}

health(); load();
`;

const REACT_WAITLIST = `import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "./config";

interface Signup { id: number; email: string; name: string | null; }

export default function App() {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [count, setCount] = useState(0);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("checking");

  const load = async () => {
    const [a, b] = await Promise.all([
      fetch(API_BASE_URL + "/api/signups").then(r => r.json()),
      fetch(API_BASE_URL + "/api/signups/count").then(r => r.json()),
    ]);
    setSignups(a.data || []);
    setCount(b.count || 0);
  };

  useEffect(() => {
    fetch(API_BASE_URL + "/api/health").then(r => r.json()).then(d => setStatus(d.status === "online" ? "online" : "offline")).catch(() => setStatus("offline"));
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("Valid email required"); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(API_BASE_URL + "/api/signups", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email, name }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      setEmail(""); setName("");
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="text-sm mb-4">{status === "online" ? "● Online" : "○ Offline"} · {count} signups</div>
      <h1 className="text-3xl font-bold mb-6">Join the Waitlist</h1>
      {error && <div className="text-rose-400 mb-3 text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-3 mb-8">
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full p-2 rounded bg-slate-800 border border-slate-700" />
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" className="w-full p-2 rounded bg-slate-800 border border-slate-700" />
        <button type="submit" disabled={busy} className="w-full py-2 rounded bg-emerald-600 disabled:opacity-50">{busy ? "Joining..." : "Join Waitlist"}</button>
      </form>
      <ul className="space-y-1 text-sm text-slate-300">
        {signups.map(s => <li key={s.id}>{s.email}{s.name ? " (" + s.name + ")" : ""}</li>)}
      </ul>
    </div>
  );
}
`;

const REACT_COUNTER = `import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "./config";

export default function App() {
  const [d, setD] = useState({ views: 0, upvotes: 0 });
  const [status, setStatus] = useState("checking");

  const load = async () => {
    const res = await fetch(API_BASE_URL + "/api/counters/home");
    const json = await res.json();
    setD(json.data || { views: 0, upvotes: 0 });
  };

  useEffect(() => {
    fetch(API_BASE_URL + "/api/health").then(r => r.json()).then(x => setStatus(x.status === "online" ? "online" : "offline")).catch(() => setStatus("offline"));
    load();
  }, []);

  const bump = async (a: string) => {
    await fetch(API_BASE_URL + "/api/counters/home/" + a, { method: "POST" });
    load();
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="text-sm mb-6">{status === "online" ? "● Online" : "○ Offline"}</div>
      <div className="text-5xl font-bold">{d.views}</div><div className="text-slate-400 mb-6">views</div>
      <div className="text-5xl font-bold">{d.upvotes}</div><div className="text-slate-400 mb-8">upvotes</div>
      <button onClick={() => bump("upvote")} className="px-6 py-2 mr-2 rounded bg-emerald-600">Upvote</button>
      <button onClick={() => bump("view")} className="px-6 py-2 rounded bg-slate-700">+1 View</button>
    </div>
  );
}
`;

const SVELTE_WAITLIST = `<script lang="ts">
  import { onMount } from "svelte";
  import { API_BASE_URL } from "./config";
  interface Signup { id: number; email: string; name: string | null; }
  let signups: Signup[] = [];
  let count = 0;
  let email = "";
  let name = "";
  let error: string | null = null;
  let busy = false;
  let status = "checking";

  onMount(async () => {
    try { const r = await fetch(API_BASE_URL + "/api/health"); const d = await r.json(); status = d.status === "online" ? "online" : "offline"; } catch { status = "offline"; }
    await load();
  });

  async function load() {
    const [a, b] = await Promise.all([fetch(API_BASE_URL + "/api/signups").then(r => r.json()), fetch(API_BASE_URL + "/api/signups/count").then(r => r.json())]);
    signups = a.data || []; count = b.count || 0;
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (!email.includes("@")) { error = "Valid email required"; return; }
    busy = true; error = null;
    try {
      const res = await fetch(API_BASE_URL + "/api/signups", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email, name }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      email = ""; name = ""; await load();
    } catch (err: any) { error = err.message; }
    finally { busy = false; }
  }
</script>

<div class="max-w-xl mx-auto px-4 py-12">
  <div class="text-sm mb-4">{status === "online" ? "● Online" : "○ Offline"} · {count} signups</div>
  <h1 class="text-3xl font-bold mb-6">Join the Waitlist</h1>
  {#if error}<div class="text-rose-400 mb-3 text-sm">{error}</div>{/if}
  <form on:submit={submit} class="space-y-3 mb-8">
    <input type="email" required bind:value={email} placeholder="Email" class="w-full p-2 rounded bg-slate-800 border border-slate-700" />
    <input type="text" bind:value={name} placeholder="Name (optional)" class="w-full p-2 rounded bg-slate-800 border border-slate-700" />
    <button type="submit" disabled={busy} class="w-full py-2 rounded bg-emerald-600">{busy ? "Joining..." : "Join Waitlist"}</button>
  </form>
  <ul class="space-y-1 text-sm text-slate-300">
    {#each signups as s}<li>{s.email}{#if s.name} ({s.name}){/if}</li>{/each}
  </ul>
</div>
`;

const SVELTE_COUNTER = `<script lang="ts">
  import { onMount } from "svelte";
  import { API_BASE_URL } from "./config";
  let data = { views: 0, upvotes: 0 };
  let status = "checking";

  onMount(async () => {
    try { const r = await fetch(API_BASE_URL + "/api/health"); const d = await r.json(); status = d.status === "online" ? "online" : "offline"; } catch { status = "offline"; }
    await load();
  });

  async function load() {
    const res = await fetch(API_BASE_URL + "/api/counters/home");
    const json = await res.json();
    data = json.data || { views: 0, upvotes: 0 };
  }

  async function bump(a: string) {
    await fetch(API_BASE_URL + "/api/counters/home/" + a, { method: "POST" });
    await load();
  }
</script>

<div class="max-w-md mx-auto px-4 py-16 text-center">
  <div class="text-sm mb-6">{status === "online" ? "● Online" : "○ Offline"}</div>
  <div class="text-5xl font-bold">{data.views}</div><div class="text-slate-400 mb-6">views</div>
  <div class="text-5xl font-bold">{data.upvotes}</div><div class="text-slate-400 mb-8">upvotes</div>
  <button on:click={() => bump("upvote")} class="px-6 py-2 mr-2 rounded bg-emerald-600">Upvote</button>
  <button on:click={() => bump("view")} class="px-6 py-2 rounded bg-slate-700">+1 View</button>
</div>
`;

const ASTRO_WAITLIST = `---
---
<div class="guestbook-container">
  <form id="form" class="card">
    <div id="err" class="error-msg" style="display:none"></div>
    <div class="field"><label>Email</label><input type="email" id="email" required /></div>
    <div class="field"><label>Name (optional)</label><input type="text" id="name" /></div>
    <button type="submit">Join Waitlist</button>
  </form>
  <h3>Signups (<span id="count">0</span>)</h3>
  <div id="list"></div>
</div>
<script>
  const API = (import.meta.env.PUBLIC_API_URL as string) || "http://localhost:8787";
  const form = document.getElementById("form")!;
  const list = document.getElementById("list")!;
  const count = document.getElementById("count")!;
  const err = document.getElementById("err")!;

  async function load() {
    const [a, b] = await Promise.all([fetch(API + "/api/signups"), fetch(API + "/api/signups/count")]);
    const da = await a.json(); const db = await b.json();
    count.textContent = String(db.count || 0);
    list.innerHTML = (da.data || []).map((s: any) => "<div>" + s.email + (s.name ? " (" + s.name + ")" : "") + "</div>").join("") || "<p>None yet</p>";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (document.getElementById("email") as HTMLInputElement).value;
    const name = (document.getElementById("name") as HTMLInputElement).value;
    err.style.display = "none";
    try {
      const res = await fetch(API + "/api/signups", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email, name }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      (document.getElementById("email") as HTMLInputElement).value = "";
      (document.getElementById("name") as HTMLInputElement).value = "";
      await load();
    } catch (ex: any) { err.textContent = ex.message; err.style.display = "block"; }
  });
  load();
</script>
`;

const ASTRO_COUNTER = `---
---
<div class="guestbook-container" style="text-align:center">
  <h1 id="views" style="font-size:3rem">0</h1><p>views</p>
  <h1 id="upvotes" style="font-size:3rem">0</h1><p>upvotes</p>
  <button id="up">Upvote</button> <button id="view">+1 View</button>
</div>
<script>
  const API = (import.meta.env.PUBLIC_API_URL as string) || "http://localhost:8787";
  async function load() {
    const res = await fetch(API + "/api/counters/home");
    const json = await res.json();
    const d = json.data || {};
    document.getElementById("views")!.textContent = String(d.views || 0);
    document.getElementById("upvotes")!.textContent = String(d.upvotes || 0);
  }
  document.getElementById("up")!.onclick = async () => { await fetch(API + "/api/counters/home/upvote", { method: "POST" }); load(); };
  document.getElementById("view")!.onclick = async () => { await fetch(API + "/api/counters/home/view", { method: "POST" }); load(); };
  load();
</script>
`;
