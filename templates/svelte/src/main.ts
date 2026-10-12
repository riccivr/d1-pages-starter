import "./app.css";
import App from "./App.svelte";
import * as sveltePkg from "svelte";

let app: any;
if (typeof (sveltePkg as any).mount === "function") {
  app = (sveltePkg as any).mount(App, {
    target: document.getElementById("app")!,
  });
} else {
  app = new (App as any)({
    target: document.getElementById("app")!,
  });
}

export default app;
