const { existsSync, mkdirSync, rmSync, cpSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const releaseDir = "release";
const includeEntries = [
  "assets",
  "css",
  "lang",
  "module",
  "templates",
  "ui",
  "pics",
  "LICENSE.txt",
  "README.md",
  "CHANGELOG.md",
  "CREDITS.md",
  "system.json",
  "template.json"
];
const packOutputDir = ".packs-build";

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (res.status) process.exit(res.status);
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Recreate release directory cleanly
if (existsSync(releaseDir)) {
  rmSync(releaseDir, { recursive: true, force: true });
}
mkdirSync(releaseDir);

// Build steps
run("npm", ["run", "build:css"]);
run("npm", ["run", "pack"]);

// Copy required files/directories into release
for (const entry of includeEntries) {
  if (!existsSync(entry)) {
    console.log(`Skipping missing entry: ${entry}`);
    continue;
  }
  const dest = path.join(releaseDir, entry);
  cpSync(entry, dest, { recursive: true });
}

// Copy generated pack DBs into release/packs; ensure the directory exists
const releasePacksDir = path.join(releaseDir, "packs");
ensureDir(releasePacksDir);
if (existsSync(packOutputDir)) {
  cpSync(packOutputDir, releasePacksDir, { recursive: true });
} else {
  console.log(`Pack output directory not found (${packOutputDir}); release packs will be empty.`);
}

console.log(`Release folder prepared at ${releaseDir}`);
