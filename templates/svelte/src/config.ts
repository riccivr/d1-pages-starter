export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8787"
    : "https://your-worker-name.your-subdomain.workers.dev");
