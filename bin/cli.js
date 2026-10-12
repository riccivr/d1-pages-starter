#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { c, symbols, promptText, promptSelect, promptConfirm } from "./prompts.js";
import {
  copyDir,
  generateSchema,
  generateWorkerCode,
  generateRustCargoToml,
  generateTailoredReadme,
} from "./scaffold.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function printBanner() {
  console.log(`
${c.orange("  ██████╗  ██╗   ██████╗  █████╗  ██████╗ ███████╗███████╗")}
${c.orange("  ██╔══██╗███║   ██╔══██╗██╔══██╗██╔════╝ ██╔════╝██╔════╝")}
${c.orange("  ██║  ██║╚██║   ██████╔╝███████║██║  ███╗█████╗  ███████╗")}
${c.orange("  ██║  ██║ ██║   ██╔═══╝ ██╔══██║██║   ██║██╔══╝  ╚════██║")}
${c.orange("  ██████╔╝ ██║   ██║     ██║  ██║╚██████╔╝███████╗███████║")}
${c.orange("  ╚═════╝  ╚═╝   ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝")}
${c.dim("  Scaffold 100% Free Edge Web Apps • GitHub Pages + Cloudflare Workers")}
`);
}

async function main() {
  printBanner();

  // 1. Project Directory / Name
  const cliArgTarget = process.argv[2];
  let projectName = cliArgTarget;

  if (!projectName) {
    projectName = await promptText({
      message: "What is your project name?",
      defaultValue: "my-edge-app",
    });
  }

  const targetDir = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    const overwrite = await promptConfirm({
      message: `Directory "${projectName}" is not empty. Continue and overwrite files?`,
      defaultValue: false,
    });
    if (!overwrite) {
      console.log(c.yellow("\nOperation cancelled."));
      process.exit(0);
    }
  }

  // 2. Database Selection
  const dbChoice = await promptSelect({
    message: "Select your database engine:",
    choices: [
      {
        title: "Cloudflare D1 (Recommended)",
        value: "d1",
        hint: "Serverless SQLite, native worker binding, zero tokens needed, 5GB free",
      },
      {
        title: "Turso (libSQL)",
        value: "turso",
        hint: "Distributed SQLite over HTTP, 500 DBs, 9GB storage, generous free tier",
      },
    ],
    defaultIndex: 0,
  });

  // 3. Backend Language Selection
  const backendChoice = await promptSelect({
    message: "Select your edge backend language:",
    choices: [
      {
        title: "TypeScript (Recommended)",
        value: "typescript",
        hint: "V8 native, fastest development, zero extra toolchains needed",
      },
      {
        title: "Rust (WebAssembly / worker-rs)",
        value: "rust",
        hint: "Compiled Wasm, ultra-low memory, type safety, native D1",
      },
      {
        title: "Python (Native Worker)",
        value: "python",
        hint: "Pyodide Wasm runtime, native D1 support",
      },
    ],
    defaultIndex: 0,
  });

  // 4. Frontend Selection
  const frontendChoice = await promptSelect({
    message: "Select your frontend framework:",
    choices: [
      {
        title: "Vanilla HTML/CSS/JS",
        value: "vanilla",
        hint: "Zero build step, runs instantly in browser, lightweight",
      },
      {
        title: "React + Vite",
        value: "react",
        hint: "TypeScript, Tailwind CSS, Lucide icons, optimistic UI",
      },
      {
        title: "Astro",
        value: "astro",
        hint: "Ultra-fast static site generator with interactive client islands",
      },
      {
        title: "Svelte 5",
        value: "svelte",
        hint: "Svelte 5 runes, Vite, TypeScript, ultra-lean bundle",
      },
    ],
    defaultIndex: 0,
  });

  // 5. Use Case / Schema Preset
  const presetChoice = await promptSelect({
    message: "Select an application preset:",
    choices: [
      {
        title: "Community Guestbook / Feed",
        value: "guestbook",
        hint: "Visitor comments, author names, real-time edge posts",
      },
      {
        title: "Waitlist & Newsletter Capture",
        value: "waitlist",
        hint: "Email subscriber signup form, validation, and count",
      },
      {
        title: "Upvote & Reaction Counters",
        value: "counter",
        hint: "Atomic pageview counters and like button increments",
      },
    ],
    defaultIndex: 0,
  });

  // 6. GitHub Actions CI/CD
  const includeCI = await promptConfirm({
    message: "Include automated GitHub Actions CI/CD workflows for GitHub Pages & Workers?",
    defaultValue: true,
  });

  console.log(`\n${c.cyan(symbols.sparkle)} ${c.bold("Scaffolding your edge web app...")}`);

  // Create target directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy chosen frontend into frontend/
  const frontendSourceDir = path.join(repoRoot, "templates", frontendChoice);
  const frontendDestDir = path.join(targetDir, "frontend");
  copyDir(frontendSourceDir, frontendDestDir);

  // Setup worker/ directory
  const workerDestDir = path.join(targetDir, "worker");
  fs.mkdirSync(path.join(workerDestDir, "src"), { recursive: true });

  // Generate worker schema.sql
  const schemaContent = generateSchema(presetChoice);
  fs.writeFileSync(path.join(workerDestDir, "schema.sql"), schemaContent, "utf-8");

  // Worker Code Generation by Language
  if (backendChoice === "rust") {
    // Rust Cargo.toml
    const cargoToml = generateRustCargoToml(projectName);
    fs.writeFileSync(path.join(workerDestDir, "Cargo.toml"), cargoToml, "utf-8");

    // Rust src/lib.rs
    const rustCode = generateWorkerCode({ db: dbChoice, preset: presetChoice, lang: "rust" });
    fs.writeFileSync(path.join(workerDestDir, "src", "lib.rs"), rustCode, "utf-8");
  } else if (backendChoice === "python") {
    // Python entry.py
    const pyCode = generateWorkerCode({ db: dbChoice, preset: presetChoice, lang: "python" });
    fs.writeFileSync(path.join(workerDestDir, "src", "entry.py"), pyCode, "utf-8");
  } else {
    // TypeScript index.ts
    const tsCode = generateWorkerCode({ db: dbChoice, preset: presetChoice, lang: "typescript" });
    fs.writeFileSync(path.join(workerDestDir, "src", "index.ts"), tsCode, "utf-8");

    // TypeScript tsconfig.json
    const tsconfigWorker = {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ESNext"],
        types: ["@cloudflare/workers-types"],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src/**/*"],
    };
    fs.writeFileSync(
      path.join(workerDestDir, "tsconfig.json"),
      JSON.stringify(tsconfigWorker, null, 2),
      "utf-8"
    );
  }

  // Generate worker wrangler.jsonc
  const wranglerConfig = {
    $schema: "node_modules/wrangler/config-schema.json",
    name: `${projectName}-api`,
    compatibility_date: "2025-02-01",
    vars: {
      ALLOWED_ORIGIN: "*",
    },
  };

  if (backendChoice === "rust") {
    wranglerConfig.main = "build/index.js";
    wranglerConfig.build = {
      command: "cargo install -q worker-build && worker-build --release",
    };
  } else if (backendChoice === "python") {
    wranglerConfig.main = "src/entry.py";
    wranglerConfig.compatibility_flags = ["python_workers"];
  } else {
    wranglerConfig.main = "src/index.ts";
    wranglerConfig.compatibility_flags = ["nodejs_compat"];
  }

  if (dbChoice === "d1") {
    wranglerConfig.d1_databases = [
      {
        binding: "DB",
        database_name: `${projectName}-db`,
        database_id: "REPLACE_WITH_D1_DATABASE_ID",
      },
    ];
  }

  fs.writeFileSync(
    path.join(workerDestDir, "wrangler.jsonc"),
    JSON.stringify(wranglerConfig, null, 2),
    "utf-8"
  );

  // Generate worker package.json
  const workerPkg = {
    name: `${projectName}-worker`,
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "wrangler dev",
      deploy: "wrangler deploy",
    },
    devDependencies: {
      "@cloudflare/workers-types": "^4.20250204.0",
      typescript: "^5.7.3",
      wrangler: "^3.107.0",
    },
  };

  if (dbChoice === "d1") {
    workerPkg.scripts["db:init:local"] = `wrangler d1 execute ${projectName}-db --local --file=./schema.sql`;
    workerPkg.scripts["db:init:remote"] = `wrangler d1 execute ${projectName}-db --remote --file=./schema.sql`;
  } else if (backendChoice === "typescript") {
    workerPkg.dependencies = {
      "@libsql/client": "^0.14.0",
    };
  }

  fs.writeFileSync(
    path.join(workerDestDir, "package.json"),
    JSON.stringify(workerPkg, null, 2),
    "utf-8"
  );

  // Generate .gitignore
  const gitignoreContent = `node_modules/
dist/
target/
.output/
.astro/
.wrangler/
.env
.env.local
.DS_Store
Thumbs.db
`;
  fs.writeFileSync(path.join(targetDir, ".gitignore"), gitignoreContent, "utf-8");

  // Generate root package.json
  const rootPkg = {
    name: projectName,
    version: "1.0.0",
    private: true,
    scripts: {
      "dev:frontend": "npm --prefix frontend run dev",
      "build:frontend": "npm --prefix frontend run build",
      "dev:worker": "npm --prefix worker run dev",
      "deploy:worker": "npm --prefix worker run deploy",
    },
  };
  if (dbChoice === "d1") {
    rootPkg.scripts["db:init:local"] = "npm --prefix worker run db:init:local";
    rootPkg.scripts["db:init:remote"] = "npm --prefix worker run db:init:remote";
  }
  fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify(rootPkg, null, 2), "utf-8");

  // Generate tailored README
  const readmeContent = generateTailoredReadme({
    projectName,
    db: dbChoice,
    frontend: frontendChoice,
    backendLang: backendChoice,
    preset: presetChoice,
    ci: includeCI,
  });
  fs.writeFileSync(path.join(targetDir, "README.md"), readmeContent, "utf-8");

  // CI Workflows if selected
  if (includeCI) {
    const ghWorkflowsDir = path.join(targetDir, ".github", "workflows");
    fs.mkdirSync(ghWorkflowsDir, { recursive: true });

    // Deploy Pages Workflow
    const deployPagesWorkflow = `name: Deploy to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      ${
        frontendChoice === "vanilla"
          ? `- name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./frontend`
          : `- name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Build Frontend
        run: |
          cd frontend
          npm ci
          npm run build
      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./frontend/dist`
      }
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
    fs.writeFileSync(path.join(ghWorkflowsDir, "deploy-pages.yml"), deployPagesWorkflow, "utf-8");

    // Deploy Worker Workflow
    const deployWorkerWorkflow = `name: Deploy Cloudflare Worker

on:
  push:
    paths:
      - "worker/**"
    branches: ["main"]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      ${
        backendChoice === "rust"
          ? `- uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      - run: cargo install -q worker-build`
          : ""
      }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: 'worker'
`;
    fs.writeFileSync(path.join(ghWorkflowsDir, "deploy-worker.yml"), deployWorkerWorkflow, "utf-8");
  }

  // Done!
  console.log(`
${c.green(symbols.check)} ${c.bold("Success! Generated project in:")} ${c.brightCyan(targetDir)}

${c.bold("Chosen Configuration:")}
  ${c.dim("•")} Database: ${c.orange(dbChoice === "d1" ? "Cloudflare D1" : "Turso")}
  ${c.dim("•")} Backend:  ${c.brightCyan(backendChoice.toUpperCase())}
  ${c.dim("•")} Frontend: ${c.orange(frontendChoice.toUpperCase())}
  ${c.dim("•")} Preset:   ${c.brightCyan(presetChoice)}

${c.bold("Next Steps:")}
  ${c.dim("1.")} ${c.orange(`cd ${projectName}`)}
  ${c.dim("2.")} Follow setup instructions in ${c.brightCyan("README.md")}
  ${c.dim("3.")} ${c.orange("npm run dev:worker")}  ${c.dim("# Launch local edge API")}
  ${c.dim("4.")} ${c.orange("npm run dev:frontend")}${c.dim("# Launch frontend interface")}
`);
}

main().catch((err) => {
  console.error(`\n${c.red("Error:")} ${err.message}`);
  process.exit(1);
});
