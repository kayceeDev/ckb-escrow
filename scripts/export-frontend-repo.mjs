#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const artifactsDir = join(root, "artifacts");
const npmArtifactsDir = join(artifactsDir, "npm");
const exportDir = join(artifactsDir, "frontend-repo");
const frontendDir = join(root, "packages", "frontend");
const tarballVendorDir = join(exportDir, "vendor");

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      npm_config_cache: join(artifactsDir, ".npm-cache"),
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureCleanDir(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
  mkdirSync(path, { recursive: true });
}

ensureCleanDir(npmArtifactsDir);
ensureCleanDir(exportDir);

run("npm", ["run", "build", "--workspace", "@ckb-escrow/sdk"]);
run("npm", ["run", "build", "--workspace", "@ckb-escrow/ccc-adapter"]);
run("npm", ["run", "build", "--workspace", "@ckb-escrow/app"]);

run("npm", ["pack", "--pack-destination", npmArtifactsDir], join(root, "packages", "escrow-sdk"));
run("npm", ["pack", "--pack-destination", npmArtifactsDir], join(root, "packages", "ccc-adapter"));
run("npm", ["pack", "--pack-destination", npmArtifactsDir], join(root, "packages", "escrow-app"));

cpSync(frontendDir, exportDir, {
  recursive: true,
  filter(source) {
    return !source.includes(`${join("packages", "frontend", "dist")}`)
      && !source.includes(`${join("packages", "frontend", "node_modules")}`);
  },
});

mkdirSync(tarballVendorDir, { recursive: true });

const tarballs = [
  "ckb-escrow-sdk-0.1.0.tgz",
  "ckb-escrow-ccc-adapter-0.1.0.tgz",
  "ckb-escrow-app-0.1.0.tgz",
];

for (const tarball of tarballs) {
  cpSync(join(npmArtifactsDir, tarball), join(tarballVendorDir, tarball));
}

const packageJsonPath = join(exportDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

packageJson.name = "ckb-escrow-frontend";
packageJson.dependencies["@ckb-escrow/app"] = "./vendor/ckb-escrow-app-0.1.0.tgz";

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

const readme = `
# ckb-escrow-frontend

Standalone frontend export generated from the monorepo.

## Setup

1. npm install
2. npm run typecheck
3. npm run build
4. git init

The shared escrow packages are vendored under \`vendor/\`.
`;

writeFileSync(join(exportDir, "README.md"), readme.trimStart());

console.log(`Exported frontend repo to ${exportDir}`);
