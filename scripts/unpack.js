const { existsSync, readdirSync, statSync, mkdirSync, rmSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const cli = path.join("node_modules", "@foundryvtt", "foundryvtt-cli", "fvtt.mjs");
const outRoot = "packs"; // YAML destination
const srcRoot = ".packs-build"; // DB source
const systemId = "how-to-be-a-hero";

if (!existsSync(cli)) {
  console.error("Foundry CLI not installed. Run npm install.");
  process.exit(1);
}

if (!existsSync(srcRoot)) {
  console.log(`Skipping pack unpack: ${srcRoot} not found.`);
  process.exit(0);
}

// Find .db files in srcRoot
const dbFiles = readdirSync(srcRoot)
  .map((entry) => path.join(srcRoot, entry))
  .filter((p) => statSync(p).isFile() && p.endsWith(".db"));

if (!dbFiles.length) {
  console.log(`No .db files found in ${srcRoot}; nothing to unpack.`);
  process.exit(0);
}

// Ensure destination exists
if (!existsSync(outRoot)) mkdirSync(outRoot, { recursive: true });

for (const dbPath of dbFiles) {
  const compendiumName = path.basename(dbPath, ".db");
  const destDir = path.join(outRoot, compendiumName);
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  const args = [
    cli,
    "package",
    "unpack",
    "--type",
    "System",
    "--id",
    systemId,
    "--compendiumName",
    compendiumName,
    "--inputDirectory",
    srcRoot,
    "--outputDirectory",
    destDir,
    "--yaml",
    "--folders",
    "--recursive"
  ];

  console.log(`Unpacking ${compendiumName} from ${dbPath}...`);
  const res = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (res.status) {
    console.error(`Unpacking ${compendiumName} failed with code ${res.status}`);
    process.exit(res.status);
  }
}

console.log("Unpack complete.");
