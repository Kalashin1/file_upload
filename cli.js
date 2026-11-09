#!/usr/bin/env node
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const HELP = `
Usage: create-express-ts <project-name> [options]

Scaffold a Node.js + TypeScript + Express starter.

Options:
  -h, --help        Show this help
  --no-install      Skip npm install (files only)
`;

// ---------- templates ----------

const pkgJson = (name) =>
  JSON.stringify(
    {
      name,
      version: "1.0.0",
      type: "commonjs",
      main: "dist/index.js",
      scripts: {
        dev: "tsx watch src/index.ts",
        build: "tsc",
        start: "node dist/index.js",
      },
      dependencies: { express: "^4.19.2" },
      devDependencies: {
        "@types/express": "^4.17.21",
        "@types/node": "^20.14.0",
        tsx: "^4.16.0",
        typescript: "^5.4.5",
      },
    },
    null,
    2
  ) + "\n";

const tsconfigJson =
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "commonjs",
        lib: ["ES2020"],
        rootDir: "./src",
        outDir: "./dist",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        moduleResolution: "node",
        sourceMap: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2
  ) + "\n";

const gitignore = `node_modules
dist
.env
*.log
`;

const indexTs = `import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Hello from Express + TypeScript!" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running at http://localhost:\${PORT}\`);
});
`;

// ---------- helpers ----------

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))
    );
  });
}

function validateName(name) {
  if (!name) return "project name is required";
  if (name.includes("/") || name.includes("\\")) return "must be a plain folder name (no slashes)";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name))
    return "must start alphanumeric and contain only letters, numbers, . _ -";
  return null;
}

// ---------- main ----------

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      "no-install": { type: "boolean" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP.trim());
    process.exit(values.help ? 0 : 1);
  }

  const name = positionals[0];
  const invalid = validateName(name);
  if (invalid) {
    console.error(c.red(`Error: ${invalid}`));
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), name);
  if (existsSync(targetDir)) {
    console.error(c.red(`Error: directory already exists: ${targetDir}`));
    process.exit(1);
  }

  console.log(`\nCreating ${c.bold(name)} ...`);
  mkdirSync(path.join(targetDir, "src"), { recursive: true });

  const files = {
    "package.json": pkgJson(name),
    "tsconfig.json": tsconfigJson,
    ".gitignore": gitignore,
    "src/index.ts": indexTs,
  };

  for (const [rel, content] of Object.entries(files)) {
    writeFileSync(path.join(targetDir, rel), content);
    console.log(`  ${c.green("created")} ${rel}`);
  }

  if (values["no-install"]) {
    console.log(c.dim("\nSkipped install (--no-install)"));
  } else {
    console.log("\nInstalling dependencies...\n");
    await run("npm", ["install"], targetDir);
    console.log(c.green("\n✓ Dependencies installed"));
  }

  console.log(`
${c.green("✓ Done!")} Next steps:

  ${c.dim("cd")} ${name}
  ${c.dim("npm run dev")}                        # hot-reload dev server
  ${c.dim("npm run build && npm start")}         # production build + run

  Server: ${c.bold("http://localhost:3000")}
`);
}

main().catch((err) => {
  console.error(c.red(`\nError: ${err.message}`));
  process.exit(1);
});
