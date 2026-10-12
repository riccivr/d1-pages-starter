// Configuration for the Turso Pages frontend
// Point this to your deployed Cloudflare Worker URL or localhost during development
const CONFIG = {
  // Example production: "https://turso-pages-api.<your-subdomain>.workers.dev"
  // Example local dev: "http://localhost:8787"
  API_BASE_URL: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8787"
    : "https://d1-pages-api.riccivr.workers.dev",
};

// Export to window for vanilla JS usage
window.CONFIG = CONFIG;
